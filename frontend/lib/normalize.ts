import type { FactoryState, Health, Workflow, Execution, Dataset, FactoryEvent } from "@/lib/api/schemas";
import { asText, pick, titleCase, type Tone } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Nebius status — we never claim success the backend did not report.   */
/* ------------------------------------------------------------------ */
export type NebiusState = "verified" | "configured" | "unconfigured" | "failed" | "unknown";
export interface NebiusStatus {
  state: NebiusState;
  label: string;
  detail: string;
  tone: Tone;
}

const NEBIUS_META: Record<NebiusState, { label: string; tone: Tone }> = {
  verified: { label: "Verified", tone: "green" },
  configured: { label: "Configured · not verified", tone: "amber" },
  unconfigured: { label: "Not configured", tone: "neutral" },
  failed: { label: "Error", tone: "red" },
  unknown: { label: "Unknown", tone: "neutral" },
};

function make(state: NebiusState, detail: string): NebiusStatus {
  return { state, detail, ...NEBIUS_META[state] };
}

function fromValue(value: unknown): NebiusStatus | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? make("configured", "Backend reports Nebius enabled.") : make("unconfigured", "Backend reports Nebius disabled.");
  if (typeof value === "string") {
    const s = value.toLowerCase().trim();
    if (/(fail|error|unavailable|timeout)/.test(s)) return make("failed", value);
    if (/(not.?configured|unconfigured|missing|disabled|rules)/.test(s)) return make("unconfigured", value);
    if (/(unverified|configured|ready|enabled)/.test(s)) return make("configured", value);
    if (s === "verified") return make("verified", "Backend reports a verified Nebius inference.");
    return make("unknown", value);
  }
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (rec.error) return make("failed", asText(rec.error));
    if (rec.verified === true) return make("verified", asText(pick(rec, "detail", "message", "model"), "Backend reports a verified Nebius inference."));
    const nested = fromValue(pick(rec, "status", "state"));
    if (nested && nested.state !== "unknown") return nested;
    if (rec.configured === true || rec.ai_configured === true) return make("configured", "Credentials present; no verified inference reported.");
    if (rec.configured === false || rec.ai_configured === false) return make("unconfigured", "Nebius credentials are not set.");
    return nested;
  }
  return null;
}

export function resolveNebius(health?: Health | null, state?: FactoryState | null, backendDown = false): NebiusStatus {
  if (backendDown) return make("unknown", "Backend unreachable — status unavailable.");
  const direct = fromValue(state?.nebius_status) ?? fromValue(health?.nebius_status) ?? fromValue(health?.nebius);
  if (direct) return direct;
  if (health?.ai_configured === true) return make("configured", `Credentials present${health.model ? ` (model ${health.model})` : ""}; no verified inference yet.`);
  if (health?.ai_configured === false) return make("unconfigured", "Running deterministic rules only.");
  return make("unknown", "No Nebius status reported by the backend.");
}

/* ------------------------------------------------------------------ */
/* KPIs                                                                */
/* ------------------------------------------------------------------ */
export interface KpiView {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  derived?: boolean;
}

function kpiFromEntry(key: string, raw: unknown): KpiView {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    const unit = asText(pick(rec, "unit"), "");
    const value = asText(pick(rec, "value", "current", "count"));
    return {
      key,
      label: asText(pick(rec, "label", "name"), titleCase(key)),
      value: unit && value !== "—" ? `${value}${unit.startsWith("%") ? "" : " "}${unit}` : value,
      hint: pick<string>(rec, "hint", "description", "delta"),
    };
  }
  return { key, label: titleCase(key), value: typeof raw === "number" && !Number.isInteger(raw) ? raw.toFixed(1) : asText(raw) };
}

export function deriveKpis(state: FactoryState): KpiView[] {
  const availableWorkers = state.workers.filter((w) => w.available !== false).length;
  const availableRobots = state.robots.filter((r) => r.available !== false).length;
  const inProgress = state.orders.filter((o) => /(progress|running|active|assigned)/i.test(String(o.status ?? ""))).length;
  const completed = state.orders.filter((o) => /(complete|done|closed)/i.test(String(o.status ?? ""))).length;
  const atRisk = state.machines.filter((m) => /(fail|fault|warn|risk|degrad|down)/i.test(String(m.status ?? ""))).length;
  const progressPct = state.orders.length ? Math.round(((completed + inProgress * 0.5) / state.orders.length) * 100) : 0;
  const workerPct = state.workers.length ? Math.round((availableWorkers / state.workers.length) * 100) : 0;
  const robotPct = state.robots.length ? Math.round((availableRobots / state.robots.length) * 100) : 0;
  return [
    {
      key: "active_orders",
      label: "Active Work Orders",
      value: String(state.orders.length),
      hint: inProgress ? `${inProgress} in progress` : "From factory state",
      tone: "blue",
      derived: true,
    },
    {
      key: "workers",
      label: "Available Workers",
      value: `${availableWorkers} / ${state.workers.length}`,
      hint: `${workerPct}% available`,
      tone: "green",
      derived: true,
    },
    {
      key: "robots",
      label: "Available Robots",
      value: `${availableRobots} / ${state.robots.length}`,
      hint: `${robotPct}% available`,
      tone: "violet",
      derived: true,
    },
    {
      key: "production_progress",
      label: "Production Progress",
      value: `${progressPct}%`,
      hint: completed ? `${completed} completed` : "Derived from order status",
      tone: "blue",
      derived: true,
    },
    {
      key: "safety_status",
      label: "Safety Status",
      value: atRisk === 0 ? "All Clear" : `${atRisk} exception${atRisk === 1 ? "" : "s"}`,
      hint: atRisk === 0 ? "No machine faults" : "Review machines at risk",
      tone: atRisk === 0 ? "green" : "red",
      derived: true,
    },
  ];
}

export function normalizeKpis(state: FactoryState): KpiView[] {
  const raw = state.kpis;
  let views: KpiView[] = [];
  if (Array.isArray(raw)) {
    views = raw.map((item, i) => kpiFromEntry(asText(pick(item, "key", "id", "name"), `kpi_${i}`), item));
  } else if (raw && typeof raw === "object") {
    views = Object.entries(raw as Record<string, unknown>).map(([k, v]) => kpiFromEntry(k, v));
  }
  return views.length ? views : deriveKpis(state);
}

/* ------------------------------------------------------------------ */
/* Events / workflows / executions                                     */
/* ------------------------------------------------------------------ */
export function eventTitle(e: FactoryEvent): string {
  return asText(pick(e, "message", "summary", "type", "event_type"), "Event");
}
export function eventTime(e: FactoryEvent): unknown {
  return pick(e, "timestamp", "created_at");
}
export function eventKey(e: FactoryEvent, index: number): string {
  return `${asText(e.id, "evt")}-${index}`;
}

export const PIPELINE_STAGES = ["Event detected", "Recommendation", "Proposal", "Approval", "Simulation", "Audit"] as const;

export interface StageView {
  id: string;
  label: string;
  status: string;
}

export function workflowStages(workflow?: Workflow | null): StageView[] {
  const raw = workflow?.stages ?? workflow?.steps;
  if (!raw?.length) return [];
  return raw.map((s, i) => ({
    id: asText(s.id, String(i)),
    label: asText(pick(s, "label", "name"), `Stage ${i + 1}`),
    status: asText(s.status, "pending"),
  }));
}

export function executionSteps(execution?: Execution | null): StageView[] {
  const raw = execution?.steps;
  if (!raw?.length) return [];
  return raw.map((s, i) => ({
    id: asText(s.id, String(i)),
    label: asText(pick(s, "label", "name"), `Step ${i + 1}`),
    status: asText(s.status, "completed"),
  }));
}

/** Extract a nested id from a mutation response: top-level key, or `{ <entity>: { id } }`. */
export function extractId(response: unknown, entity: string, ...topKeys: string[]): string | number | undefined {
  const top = pick<string | number>(response, ...topKeys);
  if (top !== undefined) return top;
  const nested = pick(response, entity);
  if (nested && typeof nested === "object") return pick<string | number>(nested, "id");
  return undefined;
}

/* ------------------------------------------------------------------ */
/* AI4I measurements                                                   */
/* ------------------------------------------------------------------ */
export interface Measurement {
  udi: number;
  type?: string;
  airTemp?: number;
  processTemp?: number;
  rpm?: number;
  torque?: number;
  toolWear?: number;
  failure: boolean;
}

const FIELD_ALIASES: Record<string, string[]> = {
  udi: ["udi", "UDI"],
  type: ["type", "Type"],
  airTemp: ["air_temperature_k", "air_temperature", "air_temp", "Air temperature [K]"],
  processTemp: ["process_temperature_k", "process_temperature", "process_temp", "Process temperature [K]"],
  rpm: ["rotational_speed_rpm", "rotational_speed", "rpm", "Rotational speed [rpm]"],
  torque: ["torque_nm", "torque", "Torque [Nm]"],
  toolWear: ["tool_wear_min", "tool_wear", "Tool wear [min]"],
  failure: ["machine_failure", "failure", "Machine failure"],
};

function num(rec: Record<string, unknown>, field: string): number | undefined {
  for (const key of FIELD_ALIASES[field]) {
    const v = rec[key];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

export function toMeasurement(rec: Record<string, unknown>, fallbackIndex: number): Measurement | null {
  const m: Measurement = {
    udi: num(rec, "udi") ?? fallbackIndex + 1,
    airTemp: num(rec, "airTemp"),
    processTemp: num(rec, "processTemp"),
    rpm: num(rec, "rpm"),
    torque: num(rec, "torque"),
    toolWear: num(rec, "toolWear"),
    failure: (num(rec, "failure") ?? 0) > 0,
  };
  const t = FIELD_ALIASES.type.map((k) => rec[k]).find((v) => typeof v === "string");
  if (typeof t === "string") m.type = t;
  const hasSignal = [m.airTemp, m.processTemp, m.rpm, m.torque, m.toolWear].some((v) => v !== undefined);
  return hasSignal ? m : null;
}

/** Collect AI4I rows exposed by /api/datasets (measurements/sample) or event payloads. */
export function collectMeasurements(datasets: Dataset[] = [], events: FactoryEvent[] = []): Measurement[] {
  const rows: Record<string, unknown>[] = [];
  for (const d of datasets) {
    for (const key of ["measurements", "sample", "records", "preview", "rows_sample"]) {
      const v = (d as Record<string, unknown>)[key];
      if (Array.isArray(v)) rows.push(...(v.filter((r) => r && typeof r === "object") as Record<string, unknown>[]));
    }
  }
  for (const e of events) {
    const payload = e.payload;
    if (payload && typeof payload === "object") rows.push({ udi: e.udi, ...(payload as Record<string, unknown>) });
  }
  const out: Measurement[] = [];
  const seen = new Set<number>();
  rows.forEach((r, i) => {
    const m = toMeasurement(r, i);
    if (m && !seen.has(m.udi)) {
      seen.add(m.udi);
      out.push(m);
    }
  });
  return out;
}
