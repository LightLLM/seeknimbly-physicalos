import httpx

c = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30)
print("health", c.get("/api/health").json())
print("state machines", len(c.get("/api/state").json().get("machines", [])))
r = c.post("/api/events/replay", json={})
print("replay", r.status_code, {k: r.json().get(k) for k in ["udi", "machine_id", "order_id", "workflow_id"]})
rec = c.get("/api/recommend/O1").json()
print("recommend", {k: rec.get(k) for k in ["worker_id", "robot_id", "machine_id", "source"]})
rec["workflow_id"] = r.json()["workflow_id"]
p = c.post("/api/proposals", json=rec).json()
print("proposal", p)
d = c.post(f"/api/proposals/{p['id']}/decision", json={"approve": True}).json()
print("decision", d)
s = c.post(f"/api/workflows/{p['workflow_id']}/simulate", json={}).json()
print("simulate", {k: s.get(k) for k in ["status", "execution_id", "simulated"]})
print("audit actions", [a["action"] for a in c.get("/api/audit").json()][:8])
