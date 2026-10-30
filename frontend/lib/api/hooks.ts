"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, withStateFallback } from "./endpoints";
import type { Id, Recommendation } from "./schemas";

export const qk = {
  health: ["health"] as const,
  state: ["state"] as const,
  proposals: ["proposals"] as const,
  audit: ["audit"] as const,
  datasets: ["datasets"] as const,
  machines: ["machines"] as const,
  robots: ["robots"] as const,
  events: ["events"] as const,
  workflows: ["workflows"] as const,
  workflow: (id: Id) => ["workflow", String(id)] as const,
  executions: ["executions"] as const,
  execution: (id: Id) => ["execution", String(id)] as const,
};

export const useHealth = () => useQuery({ queryKey: qk.health, queryFn: api.health, refetchInterval: 30_000 });
export const useFactoryState = () => useQuery({ queryKey: qk.state, queryFn: api.state, refetchInterval: 15_000 });
export const useProposals = () => useQuery({ queryKey: qk.proposals, queryFn: api.proposals, refetchInterval: 10_000 });
export const useAudit = () => useQuery({ queryKey: qk.audit, queryFn: api.audit, refetchInterval: 10_000 });
export const useDatasets = () => useQuery({ queryKey: qk.datasets, queryFn: api.datasets });
export const useMachines = () =>
  useQuery({ queryKey: qk.machines, queryFn: () => withStateFallback(api.machines, (s) => s.machines) });
export const useRobots = () =>
  useQuery({ queryKey: qk.robots, queryFn: () => withStateFallback(api.robots, (s) => s.robots) });
export const useEvents = () =>
  useQuery({ queryKey: qk.events, queryFn: () => withStateFallback(api.events, (s) => s.events), refetchInterval: 10_000 });
export const useWorkflows = () => useQuery({ queryKey: qk.workflows, queryFn: api.workflows, refetchInterval: 10_000 });
export const useWorkflow = (id: Id | undefined) =>
  useQuery({ queryKey: qk.workflow(id ?? ""), queryFn: () => api.workflow(id as Id), enabled: id !== undefined });
export const useExecutions = () => useQuery({ queryKey: qk.executions, queryFn: api.executions, refetchInterval: 10_000 });
export const useExecution = (id: Id | undefined) =>
  useQuery({ queryKey: qk.execution(id ?? ""), queryFn: () => api.execution(id as Id), enabled: id !== undefined });

/** Manual inference test — never auto-run; it may call the external provider. */
export const useInferenceTest = () => useMutation({ mutationFn: api.inferenceTest });

export function useRecommend() {
  return useMutation({ mutationFn: (orderId: Id) => api.recommend(orderId) });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useReplayEvent() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (udi?: number) => api.replayEvent(udi), onSuccess: invalidate });
}

export function useCreateProposal() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: Recommendation & { machine_id?: Id | null }) => api.createProposal(body),
    onSuccess: invalidate,
  });
}

export function useDecision() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, approve }: { id: Id; approve: boolean }) => api.decide(id, approve),
    onSuccess: invalidate,
  });
}

export function useSimulateWorkflow() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: Id) => api.simulateWorkflow(id), onSuccess: invalidate });
}

export function useImportDataset() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (body?: Record<string, unknown>) => api.importDataset(body), onSuccess: invalidate });
}

export function useResetDemo() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.resetDemo, onSuccess: invalidate });
}
