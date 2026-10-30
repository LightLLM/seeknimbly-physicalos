"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  useAudit,
  useCreateProposal,
  useDecision,
  useExecutions,
  useFactoryState,
  useProposals,
  useRecommend,
  useReplayEvent,
  useSimulateWorkflow,
  useWorkflows,
} from "@/lib/api/hooks";
import { describeError } from "@/lib/api/client";
import type { Id, Proposal, Recommendation } from "@/lib/api/schemas";
import { extractId } from "@/lib/normalize";
import { pick } from "@/lib/utils";

export type StepStatus = "todo" | "active" | "done" | "error";
export type StepKey = "replay" | "recommend" | "proposal" | "approval" | "simulate" | "audit";

export interface FlowStep {
  key: StepKey;
  label: string;
  detail: string;
  status: StepStatus;
}

interface FlowState {
  orderId?: string;
  udi?: number;
  machineId?: Id | null;
  workflowId?: Id;
  proposalId?: Id;
  executionId?: Id;
  replayed: boolean;
  recommendation?: Recommendation;
  simulated: boolean;
}

const INITIAL: FlowState = { replayed: false, simulated: false };

type Action = { type: "patch"; patch: Partial<FlowState> } | { type: "reset" };

function reducer(state: FlowState, action: Action): FlowState {
  return action.type === "reset" ? INITIAL : { ...state, ...action.patch };
}

export interface DemoFlow {
  orderId: string | undefined;
  udi: number | undefined;
  setOrderId: (id: string) => void;
  setUdi: (udi: number | undefined) => void;
  recommendation: Recommendation | undefined;
  proposal: Proposal | undefined;
  workflowId: Id | undefined;
  executionId: Id | undefined;
  steps: FlowStep[];
  currentStep: StepKey | null;
  busy: Record<"replay" | "recommend" | "proposal" | "decision" | "simulate", boolean>;
  replay: (udi?: number) => void;
  recommend: () => void;
  createProposal: () => void;
  decide: (approve: boolean) => void;
  simulate: () => void;
  resetFlow: () => void;
}

const DemoFlowContext = React.createContext<DemoFlow | null>(null);

export function useDemoFlow(): DemoFlow {
  const ctx = React.useContext(DemoFlowContext);
  if (!ctx) throw new Error("useDemoFlow must be used within DemoFlowProvider");
  return ctx;
}

export function DemoFlowProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, INITIAL);
  const patch = React.useCallback((p: Partial<FlowState>) => dispatch({ type: "patch", patch: p }), []);

  const factory = useFactoryState();
  const proposals = useProposals();
  const workflows = useWorkflows();
  const executions = useExecutions();
  const audit = useAudit();

  const replayMut = useReplayEvent();
  const recommendMut = useRecommend();
  const proposalMut = useCreateProposal();
  const decisionMut = useDecision();
  const simulateMut = useSimulateWorkflow();

  const orderId = state.orderId ?? (factory.data?.orders[0] ? String(factory.data.orders[0].id) : undefined);
  const recommendation = state.recommendation && String(state.recommendation.order_id) === orderId ? state.recommendation : undefined;
  const proposal = state.proposalId !== undefined ? proposals.data?.find((p) => String(p.id) === String(state.proposalId)) : undefined;

  const resolveWorkflowId = (): Id | undefined => {
    if (state.workflowId !== undefined) return state.workflowId;
    const list = workflows.data ?? [];
    const match =
      list.find((w) => state.proposalId !== undefined && String(w.proposal_id) === String(state.proposalId)) ??
      list.find((w) => orderId !== undefined && String(w.order_id) === orderId) ??
      list[0];
    return match?.id;
  };

  const replay = (udi?: number) => {
    replayMut.mutate(udi, {
      onSuccess: (res) => {
        const resolvedOrder = pick<string | number>(res, "order_id");
        const eventLike = pick(res, "event");
        patch({
          replayed: true,
          udi: udi ?? pick<number>(res, "udi") ?? pick<number>(eventLike, "udi"),
          workflowId: extractId(res, "workflow", "workflow_id"),
          machineId: pick<Id>(res, "machine_id") ?? pick<Id>(eventLike, "machine_id") ?? null,
          ...(resolvedOrder !== undefined ? { orderId: String(resolvedOrder) } : {}),
          // a new replay invalidates everything downstream
          recommendation: undefined,
          proposalId: undefined,
          executionId: undefined,
          simulated: false,
        });
        toast.success("Event replayed", { description: udi !== undefined ? `UDI ${udi}` : "First failure event" });
      },
      onError: (e) => toast.error("Replay failed", { description: describeError(e) }),
    });
  };

  const recommend = () => {
    if (!orderId) return toast.error("No work order available to recommend for.");
    recommendMut.mutate(orderId, {
      onSuccess: (rec) => {
        patch({ recommendation: rec });
        toast.success("Recommendation ready", {
          description: rec.source === "rules" ? "Deterministic rules (no AI explanation)" : `Source: ${rec.source}`,
        });
      },
      onError: (e) => toast.error("Recommendation failed", { description: describeError(e) }),
    });
  };

  const createProposal = () => {
    if (!recommendation) return toast.error("Request a recommendation first.");
    proposalMut.mutate(
      { ...recommendation, machine_id: recommendation.machine_id ?? state.machineId },
      {
        onSuccess: (res) => {
          patch({
            proposalId: res.id,
            workflowId: res.workflow_id ?? state.workflowId,
            simulated: false,
            executionId: undefined,
          });
          toast.success(`Proposal ${res.id} created`, { description: "Awaiting supervisor approval." });
        },
        onError: (e) => toast.error("Proposal rejected by backend", { description: describeError(e) }),
      },
    );
  };

  const decide = (approve: boolean) => {
    if (state.proposalId === undefined) return toast.error("Create a proposal first.");
    decisionMut.mutate(
      { id: state.proposalId, approve },
      {
        onSuccess: () => toast.success(approve ? "Proposal approved" : "Proposal rejected"),
        onError: (e) => toast.error("Decision failed", { description: describeError(e) }),
      },
    );
  };

  const simulate = () => {
    const id = resolveWorkflowId();
    if (id === undefined) return toast.error("No workflow available to simulate.", { description: "The backend returned no workflow for this proposal." });
    simulateMut.mutate(id, {
      onSuccess: (res) => {
        patch({
          simulated: true,
          workflowId: id,
          executionId: extractId(res, "execution", "execution_id", "id"),
        });
        toast.success("Dispatch simulated", { description: "Simulation only — no physical robot was commanded." });
      },
      onError: (e) => toast.error("Simulation failed", { description: describeError(e) }),
    });
  };

  const approval = proposal?.status?.toLowerCase();
  const executed =
    state.simulated ||
    (state.proposalId !== undefined && (executions.data ?? []).some((x) => String(x.proposal_id) === String(state.proposalId)));

  const steps: FlowStep[] = [
    { key: "replay", label: "Replay event", detail: state.replayed ? `Replayed${state.udi !== undefined ? ` UDI ${state.udi}` : ""}` : "Inject a machine failure", status: state.replayed ? "done" : "todo" },
    {
      key: "recommend",
      label: "Recommend",
      detail: recommendation ? `Worker ${recommendation.worker_id} + robot ${recommendation.robot_id}` : `Order ${orderId ?? "—"}`,
      status: recommendation ? "done" : "todo",
    },
    { key: "proposal", label: "Create proposal", detail: state.proposalId !== undefined ? `Proposal ${state.proposalId}` : "Validated server-side", status: state.proposalId !== undefined ? "done" : "todo" },
    {
      key: "approval",
      label: "Approve",
      detail: approval ? approval : "Supervisor decision",
      status: approval === "approved" ? "done" : approval === "rejected" ? "error" : "todo",
    },
    { key: "simulate", label: "Simulate", detail: executed ? "Execution recorded" : "Dry-run dispatch", status: executed ? "done" : "todo" },
    { key: "audit", label: "Audit", detail: audit.data?.length ? `${audit.data.length} entries` : "Review trail", status: executed && (audit.data?.length ?? 0) > 0 ? "done" : "todo" },
  ];

  // The next actionable step is the one after the furthest completed step, so an operator who
  // skips ahead (e.g. no event replay available) is not sent back to step 1.
  const lastDone = steps.reduce((acc, s, i) => (s.status === "done" ? i : acc), -1);
  const next = steps[lastDone + 1];
  const currentStep: StepKey | null = steps.some((s) => s.status === "error") ? null : (next?.key ?? null);
  const stepsWithActive = steps.map((s) => (s.key === currentStep ? { ...s, status: "active" as const } : s));

  const value: DemoFlow = {
    orderId,
    udi: state.udi,
    setOrderId: (id) => patch({ orderId: id, recommendation: undefined }),
    setUdi: (udi) => patch({ udi }),
    recommendation,
    proposal,
    workflowId: state.workflowId,
    executionId: state.executionId,
    steps: stepsWithActive,
    currentStep,
    busy: {
      replay: replayMut.isPending,
      recommend: recommendMut.isPending,
      proposal: proposalMut.isPending,
      decision: decisionMut.isPending,
      simulate: simulateMut.isPending,
    },
    replay,
    recommend,
    createProposal,
    decide,
    simulate,
    resetFlow: () => dispatch({ type: "reset" }),
  };

  return <DemoFlowContext.Provider value={value}>{children}</DemoFlowContext.Provider>;
}
