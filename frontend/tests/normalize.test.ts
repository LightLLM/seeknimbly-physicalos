import { describe, expect, it } from "vitest";
import { stateSchema } from "@/lib/api/schemas";
import { collectMeasurements, extractId, normalizeKpis, resolveNebius } from "@/lib/normalize";
import { statusTone } from "@/lib/utils";

describe("resolveNebius", () => {
  it("does not claim verification from configuration alone", () => {
    expect(resolveNebius({ ai_configured: true }).state).toBe("configured");
    expect(resolveNebius({ nebius_status: "configured" }).state).toBe("configured");
    expect(resolveNebius({ nebius_status: "unverified" }).state).toBe("configured");
  });
  it("only reports verified when the backend says so", () => {
    expect(resolveNebius({ nebius_status: { verified: true } }).state).toBe("verified");
    expect(resolveNebius({ nebius_status: "verified" }).state).toBe("verified");
  });
  it("handles missing credentials, errors and an unreachable backend", () => {
    expect(resolveNebius({ ai_configured: false }).state).toBe("unconfigured");
    expect(resolveNebius({ nebius_status: { error: "timeout" } }).state).toBe("failed");
    expect(resolveNebius(undefined, undefined, true).state).toBe("unknown");
  });
});

describe("state parsing and KPIs", () => {
  it("accepts the legacy 3-collection state and derives KPIs", () => {
    const state = stateSchema.parse({ workers: [{ id: 1, name: "A", skills: ["CNC"], available: true }], orders: [{ id: "O1" }], robots: [{ id: "R1", available: false }] });
    expect(state.machines).toEqual([]);
    const kpis = normalizeKpis(state);
    expect(kpis.every((k) => k.derived)).toBe(true);
    expect(kpis.find((k) => k.key === "robots")?.value).toBe("0 / 1");
  });
  it("prefers backend KPIs and formats them", () => {
    const state = stateSchema.parse({ kpis: { oee: { label: "OEE", value: 87.5, unit: "%" }, open_orders: 3 } });
    const kpis = normalizeKpis(state);
    expect(kpis[0]).toMatchObject({ label: "OEE", value: "87.5%" });
    expect(kpis[1]).toMatchObject({ label: "Open Orders", value: "3" });
  });
});

describe("helpers", () => {
  it("maps AI4I columns to measurements and de-duplicates by UDI", () => {
    const rows = collectMeasurements([
      {
        measurements: [
          { UDI: 1, "Torque [Nm]": 42.8, "Rotational speed [rpm]": 1551, "Machine failure": 0 },
          { UDI: 1, "Torque [Nm]": 42.8, "Rotational speed [rpm]": 1551, "Machine failure": 0 },
          { udi: 2, torque_nm: 60, rotational_speed_rpm: 1200, machine_failure: 1 },
        ],
      } as never,
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ udi: 2, torque: 60, rpm: 1200, failure: true });
  });
  it("extracts nested ids from mutation responses", () => {
    expect(extractId({ workflow: { id: "wf-1" } }, "workflow", "workflow_id")).toBe("wf-1");
    expect(extractId({ workflow_id: 9 }, "workflow", "workflow_id")).toBe(9);
    expect(extractId({}, "workflow", "workflow_id")).toBeUndefined();
  });
  it("treats failure words as red before availability words", () => {
    expect(statusTone("unavailable")).toBe("red");
    expect(statusTone("available")).toBe("green");
    expect(statusTone("pending")).toBe("amber");
  });
});
