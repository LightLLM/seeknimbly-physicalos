import { z, type ZodType } from "zod";
import { ApiError, request } from "./client";
import {
  auditSchema,
  datasetSchema,
  eventSchema,
  executionSchema,
  genericSchema,
  healthSchema,
  inferenceTestSchema,
  machineSchema,
  proposalCreatedSchema,
  proposalSchema,
  recommendationSchema,
  robotSchema,
  stateSchema,
  workflowSchema,
  type FactoryState,
  type Id,
  type Recommendation,
} from "./schemas";

function unwrapList(raw: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    for (const key of [...keys, "items", "data", "results"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  return [];
}

async function requestList<T>(path: string, schema: ZodType<T>, ...keys: string[]): Promise<T[]> {
  const raw = await request<unknown>(path);
  const parsed = z.array(schema).safeParse(unwrapList(raw, ...keys));
  if (!parsed.success) throw new ApiError(`Unexpected response shape from ${path}`, 200, parsed.error.issues);
  return parsed.data;
}

const enc = (id: Id) => encodeURIComponent(String(id));

export const api = {
  health: () => request("/api/health", { schema: healthSchema }),
  state: () => request("/api/state", { schema: stateSchema }),
  recommend: (orderId: Id) => request(`/api/recommend/${enc(orderId)}`, { schema: recommendationSchema }),
  inferenceTest: () => request("/api/inference/test", { schema: inferenceTestSchema }),

  proposals: () => requestList("/api/proposals", proposalSchema, "proposals"),
  createProposal: (body: Recommendation & { machine_id?: Id | null }) =>
    request("/api/proposals", {
      method: "POST",
      body: {
        order_id: body.order_id,
        worker_id: body.worker_id,
        robot_id: body.robot_id,
        source: body.source,
        rationale: body.rationale,
        model: body.model ?? null,
        ...(body.machine_id !== undefined && body.machine_id !== null ? { machine_id: body.machine_id } : {}),
      },
      schema: proposalCreatedSchema,
    }),
  decide: (id: Id, approve: boolean) =>
    request(`/api/proposals/${enc(id)}/decision`, { method: "POST", body: { approve }, schema: genericSchema }),

  audit: () => requestList("/api/audit", auditSchema, "audit", "entries"),

  datasets: () => requestList("/api/datasets", datasetSchema, "datasets"),
  importDataset: (body: Record<string, unknown> = {}) =>
    request("/api/datasets/import", { method: "POST", body, schema: genericSchema }),

  machines: () => requestList("/api/machines", machineSchema, "machines"),
  robots: () => requestList("/api/robots", robotSchema, "robots"),

  events: () => requestList("/api/events", eventSchema, "events"),
  replayEvent: (udi?: number) =>
    request("/api/events/replay", { method: "POST", body: udi === undefined ? {} : { udi }, schema: genericSchema }),

  workflows: () => requestList("/api/workflows", workflowSchema, "workflows"),
  workflow: (id: Id) => request(`/api/workflows/${enc(id)}`, { schema: workflowSchema }),
  simulateWorkflow: (id: Id) =>
    request(`/api/workflows/${enc(id)}/simulate`, { method: "POST", body: {}, schema: genericSchema }),

  executions: () => requestList("/api/executions", executionSchema, "executions"),
  execution: (id: Id) => request(`/api/executions/${enc(id)}`, { schema: executionSchema }),

  resetDemo: () => request("/api/demo/reset", { method: "POST", body: {}, schema: genericSchema }),
};

/** Dedicated endpoint first; if it is not implemented (404/405) fall back to /api/state. */
export async function withStateFallback<T>(
  primary: () => Promise<T[]>,
  pickFromState: (state: FactoryState) => T[],
): Promise<T[]> {
  try {
    return await primary();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
      return pickFromState(await api.state());
    }
    throw error;
  }
}
