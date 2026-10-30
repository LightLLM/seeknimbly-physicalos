import importlib

from fastapi.testclient import TestClient


def make_client(tmp_path, monkeypatch):
    monkeypatch.setenv("PHYSICALOS_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.delenv("DEMO_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    monkeypatch.delenv("NEBIUS_MODEL", raising=False)
    monkeypatch.setenv("PHYSICALOS_REQUIRE_AI", "false")

    import backend.app.core.config as config_module
    import backend.app.main as main_module
    import api.index as module

    config_module = importlib.reload(config_module)
    config_module.settings.reload()
    main_module = importlib.reload(main_module)
    main_module.reset_runtime_for_tests()
    module = importlib.reload(module)
    return TestClient(module.app)


def test_home(tmp_path, monkeypatch):
    response = make_client(tmp_path, monkeypatch).get("/")
    assert response.status_code == 200 and "PhysicalOS" in response.text


def test_health_rules_mode(tmp_path, monkeypatch):
    assert make_client(tmp_path, monkeypatch).get("/api/health").json()["ai_configured"] is False


def test_state_counts(tmp_path, monkeypatch):
    state = make_client(tmp_path, monkeypatch).get("/api/state").json()
    assert (len(state["workers"]), len(state["orders"]), len(state["robots"])) == (8, 5, 3)
    assert len(state["machines"]) >= 5


def test_recommendation_is_eligible(tmp_path, monkeypatch):
    result = make_client(tmp_path, monkeypatch).get("/api/recommend/O1").json()
    assert result["worker_id"] == 1 and result["robot_id"] == "R1" and result["source"] == "rules"
    assert result["machine_id"] == "M-CNC-01"


def test_unknown_order(tmp_path, monkeypatch):
    assert make_client(tmp_path, monkeypatch).get("/api/recommend/nope").status_code == 404


def test_inference_requires_credentials(tmp_path, monkeypatch):
    assert make_client(tmp_path, monkeypatch).get("/api/inference/test").status_code == 503


def test_create_proposal(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    payload = client.get("/api/recommend/O1").json()
    assert client.post("/api/proposals", json=payload).status_code == 201


def test_rejects_tampered_proposal(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    payload = client.get("/api/recommend/O1").json()
    payload["worker_id"] = 8
    assert client.post("/api/proposals", json=payload).status_code == 400


def test_approve_proposal(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    proposal = client.post("/api/proposals", json=client.get("/api/recommend/O1").json()).json()
    assert client.post(f"/api/proposals/{proposal['id']}/decision", json={"approve": True}).json()["status"] == "approved"


def test_reject_proposal(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    proposal = client.post("/api/proposals", json=client.get("/api/recommend/O2").json()).json()
    assert client.post(f"/api/proposals/{proposal['id']}/decision", json={"approve": False}).json()["status"] == "rejected"


def test_cannot_decide_twice(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    proposal = client.post("/api/proposals", json=client.get("/api/recommend/O1").json()).json()
    client.post(f"/api/proposals/{proposal['id']}/decision", json={"approve": True})
    assert client.post(f"/api/proposals/{proposal['id']}/decision", json={"approve": False}).status_code == 409


def test_audit_records_workflow(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    proposal = client.post("/api/proposals", json=client.get("/api/recommend/O1").json()).json()
    client.post(f"/api/proposals/{proposal['id']}/decision", json={"approve": True})
    actions = [item["action"] for item in client.get("/api/audit").json()]
    assert "proposal_approved" in actions and "proposal_created" in actions
