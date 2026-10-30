import importlib

from fastapi.testclient import TestClient


def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("PHYSICALOS_DB", str(tmp_path / "workflow.db"))
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.delenv("DEMO_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    monkeypatch.delenv("NEBIUS_MODEL", raising=False)
    monkeypatch.setenv("PHYSICALOS_REQUIRE_AI", "false")

    import backend.app.core.config as config_module
    import backend.app.main as main_module
    import api.index as module

    importlib.reload(config_module).settings.reload()
    main_module = importlib.reload(main_module)
    main_module.reset_runtime_for_tests()
    module = importlib.reload(module)
    return TestClient(module.app)


def test_dataset_catalog_and_import(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    datasets = client.get("/api/datasets").json()
    assert datasets and datasets[0]["license"] == "CC BY 4.0"
    imported = client.post("/api/datasets/import", json={}).json()
    assert imported["status"] == "imported"
    assert imported["row_count"] == 10000


def test_event_replay_marks_machine_fault_and_opens_workflow(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    replay = client.post("/api/events/replay", json={}).json()
    assert replay["order_id"] == "O1"
    assert replay["machine_id"] == "M-CNC-01"
    assert replay["workflow_id"]
    machines = {item["id"]: item for item in client.get("/api/machines").json()}
    assert machines["M-CNC-01"]["status"] == "fault"
    recommendation = client.get("/api/recommend/O1").json()
    assert recommendation["machine_id"] == "M-CNC-02"
    assert recommendation["worker_id"] == 1


def test_non_failure_udi_rejected(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    assert client.post("/api/events/replay", json={"udi": 1}).status_code == 400


def test_end_to_end_simulated_dispatch(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    replay = client.post("/api/events/replay", json={}).json()
    recommendation = client.get("/api/recommend/O1").json()
    recommendation["workflow_id"] = replay["workflow_id"]
    proposal = client.post("/api/proposals", json=recommendation).json()
    decision = client.post(f"/api/proposals/{proposal['id']}/decision", json={"approve": True}).json()
    assert decision["status"] == "approved"
    simulated = client.post(f"/api/workflows/{proposal['workflow_id']}/simulate", json={}).json()
    assert simulated["status"] == "completed"
    assert simulated["simulated"] is True
    assert client.post(f"/api/workflows/{proposal['workflow_id']}/simulate", json={}).status_code == 409
    executions = client.get("/api/executions").json()
    assert executions and executions[0]["status"] == "completed"
    workflow = client.get(f"/api/workflows/{proposal['workflow_id']}").json()
    assert workflow["state"] == "COMPLETED"


def test_protected_reset_with_token(tmp_path, monkeypatch):
    monkeypatch.setenv("DEMO_ADMIN_TOKEN", "secret-demo")
    client = make_client(tmp_path, monkeypatch)
    # make_client clears DEMO_ADMIN_TOKEN; set after and reload settings
    import backend.app.core.config as config_module

    monkeypatch.setenv("DEMO_ADMIN_TOKEN", "secret-demo")
    config_module.settings.reload()
    assert client.post("/api/demo/reset", json={}).status_code == 401
    ok = client.post("/api/demo/reset", json={}, headers={"X-Demo-Admin-Token": "secret-demo"})
    assert ok.status_code == 200
    assert ok.json()["status"] == "reset"


def test_unavailable_robot_blocks_before_inference(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    replay = client.post("/api/events/replay", json={"scenario": "robot_unavailable"})
    assert replay.status_code == 200
    calls = {"n": 0}

    def boom(*_args, **_kwargs):
        calls["n"] += 1
        raise AssertionError("Nebius was called")

    import backend.app.integrations.nebius as nebius

    monkeypatch.setattr(nebius, "explain_assignment", boom)
    response = client.get("/api/recommend/O1")
    assert response.status_code == 409
    assert calls["n"] == 0


def test_unqualified_assignment_never_calls_nebius(tmp_path, monkeypatch, monkeypatch_module=None):
    client = make_client(tmp_path, monkeypatch)
    # Luis (id 8) has maintenance only — tamper should 400 before any inference.
    payload = client.get("/api/recommend/O1").json()
    payload["worker_id"] = 8
    monkeypatch.setenv("NEBIUS_API_KEY", "fake")
    monkeypatch.setenv("NEBIUS_MODEL", "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B")
    import backend.app.core.config as config_module

    config_module.settings.reload()
    assert client.post("/api/proposals", json=payload).status_code == 400
