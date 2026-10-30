import { z } from "zod";

/**
 * Lenient, forward-compatible Zod schemas. The FastAPI backend is evolving, so every
 * entity is a loose object: required fields are only the ones the UI cannot work without.
 */
export const idSchema = z.union([z.string(), z.number()]);
export type Id = z.infer<typeof idSchema>;

const text = z.string().nullish();
const flag = z.boolean().nullish();
const scalar = z.union([z.string(), z.number()]).nullish();

export const workerSchema = z.looseObject({
  id: idSchema,
  name: text,
  skills: z.array(z.string()).default([]),
  available: flag,
  certifications: z.array(z.string()).nullish(),
  shift: text,
  status: text,
});
export type Worker = z.infer<typeof workerSchema>;

export const orderSchema = z.looseObject({
  id: idSchema,
  task: text,
  skill: text,
  robot_type: text,
  priority: scalar,
  status: text,
  machine_id: scalar,
  deadline: text,
  due_at: text,
});
export type Order = z.infer<typeof orderSchema>;

export const robotSchema = z.looseObject({
  id: idSchema,
  type: text,
  available: flag,
  status: text,
  location: text,
  battery: z.number().nullish(),
});
export type Robot = z.infer<typeof robotSchema>;

export const machineSchema = z.looseObject({
  id: idSchema,
  name: text,
  type: text,
  status: text,
  line: text,
  health: scalar,
  health_score: z.number().nullish(),
  risk: scalar,
  tool_wear: z.number().nullish(),
  udi: z.number().nullish(),
  product_id: text,
});
export type Machine = z.infer<typeof machineSchema>;

export const eventSchema = z.looseObject({
  id: idSchema.nullish(),
  type: text,
  event_type: text,
  severity: text,
  machine_id: scalar,
  udi: z.number().nullish(),
  message: text,
  summary: text,
  timestamp: scalar,
  created_at: scalar,
  payload: z.unknown().optional(),
});
export type FactoryEvent = z.infer<typeof eventSchema>;

export const stateSchema = z.looseObject({
  workers: z.array(workerSchema).default([]),
  orders: z.array(orderSchema).default([]),
  robots: z.array(robotSchema).default([]),
  machines: z.array(machineSchema).default([]),
  kpis: z.unknown().optional(),
  events: z.array(eventSchema).default([]),
  nebius_status: z.unknown().optional(),
});
export type FactoryState = z.infer<typeof stateSchema>;

export const healthSchema = z.looseObject({
  status: text,
  ai_configured: flag,
  model: text,
  environment: text,
  simulation_mode: flag,
  nebius_status: z.unknown().optional(),
  nebius: z.unknown().optional(),
});
export type Health = z.infer<typeof healthSchema>;

export const recommendationSchema = z.looseObject({
  order_id: idSchema,
  worker_id: idSchema,
  robot_id: idSchema,
  machine_id: scalar,
  source: z.string(),
  rationale: z.string(),
  model: text,
  inference_request_id: text,
  safety_checks: z.unknown().optional(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const proposalSchema = z.looseObject({
  id: idSchema,
  order_id: idSchema,
  worker_id: idSchema,
  robot_id: idSchema,
  machine_id: scalar,
  source: text,
  rationale: text,
  model: text,
  status: z.string(),
  created_at: text,
  decided_at: text,
  workflow_id: scalar,
});
export type Proposal = z.infer<typeof proposalSchema>;

export const proposalCreatedSchema = z.looseObject({
  id: idSchema,
  status: text,
  workflow_id: scalar,
});
export type ProposalCreated = z.infer<typeof proposalCreatedSchema>;

export const auditSchema = z.looseObject({
  id: idSchema,
  action: z.string(),
  detail: z.unknown().optional(),
  actor: text,
  created_at: text,
});
export type AuditEntry = z.infer<typeof auditSchema>;

export const datasetSchema = z.looseObject({
  id: idSchema.nullish(),
  name: text,
  source: text,
  description: text,
  license: text,
  status: text,
  rows: z.number().nullish(),
  row_count: z.number().nullish(),
  imported_at: text,
  measurements: z.array(z.record(z.string(), z.unknown())).nullish(),
  sample: z.array(z.record(z.string(), z.unknown())).nullish(),
});
export type Dataset = z.infer<typeof datasetSchema>;

const stageSchema = z.looseObject({
  id: scalar,
  name: text,
  label: text,
  status: text,
});

export const workflowSchema = z.looseObject({
  id: idSchema,
  name: text,
  status: text,
  state: text,
  current_stage: text,
  stages: z.array(stageSchema).nullish(),
  steps: z.array(stageSchema).nullish(),
  order_id: scalar,
  event_id: scalar,
  proposal_id: scalar,
  machine_id: scalar,
  created_at: text,
  updated_at: text,
});
export type Workflow = z.infer<typeof workflowSchema>;

export const executionSchema = z.looseObject({
  id: idSchema,
  workflow_id: scalar,
  proposal_id: scalar,
  status: text,
  simulated: flag,
  steps: z.array(stageSchema).nullish(),
  started_at: text,
  finished_at: text,
  created_at: text,
  summary: text,
  result: z.unknown().optional(),
});
export type Execution = z.infer<typeof executionSchema>;

export const genericSchema = z.looseObject({});

export const inferenceTestSchema = z.looseObject({
  verified: flag,
  provider: text,
  model: text,
  rationale: text,
  request_id: text,
});
export type InferenceTest = z.infer<typeof inferenceTestSchema>;
