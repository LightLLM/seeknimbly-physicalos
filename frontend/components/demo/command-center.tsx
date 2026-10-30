"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  CheckCircle2,
  ClipboardList,
  Maximize2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { DemoRunbook } from "@/components/demo/runbook";
import { useDemoFlow } from "@/components/demo/demo-flow";
import { FactoryFlow } from "@/components/flow/dynamic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Mono } from "@/components/ui/mono";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { ApiError } from "@/lib/api/client";
import { useFactoryState, useHealth, useProposals } from "@/lib/api/hooks";
import { normalizeKpis, resolveNebius } from "@/lib/normalize";
import { asText, cn, statusTone, type Tone } from "@/lib/utils";

const KPI_ICONS = [ClipboardList, Users, Bot, Activity, ShieldCheck];

const FLOW_STAGES = [
  "Event",
  "Context",
  "Safety",
  "Nemotron",
  "Approval",
  "Dispatch",
  "Monitor",
  "Audit",
] as const;

function DataFlowStrip({ activeIndex }: { activeIndex: number }) {
  return (
    <section aria-label="Operational data flow" className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Live data flow</h2>
          <p className="text-xs text-muted">Industrial event → safety → Nebius Nemotron → human approval → simulated dispatch → audit</p>
        </div>
        <Badge tone="blue" dot>
          End-to-end
        </Badge>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {FLOW_STAGES.map((label, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li
              key={label}
              className={cn(
                "rounded-xl border px-2.5 py-2 text-center text-[11px] font-medium",
                done && "border-green/40 bg-green/10 text-green",
                active && "border-blue/50 bg-blue/10 text-blue pulse-ring",
                !done && !active && "border-line bg-elevated/60 text-muted",
              )}
            >
              {label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function AiRecommendationPanel() {
  const flow = useDemoFlow();
  const rec = flow.recommendation;
  const proposal = flow.proposal;
  const source = asText(rec?.source, "—");
  const isAi = /nebius|nemotron/i.test(source) && !/rules|fallback/i.test(source);
  const explanation = asText(rec?.rationale, "Request a recommendation to populate this panel from the live API.");

  return (
    <Card className="shadow-sm" aria-label="AI recommendations">
      <CardHeader
        title="AI Recommendations"
        description="Validated assignment + Nebius explanation. AI never approves dispatch."
        action={
          <Badge tone={isAi ? "violet" : "neutral"} dot>
            {isAi ? "Nemotron" : "Rules / pending"}
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        {rec ? (
          <div className="rounded-2xl border border-blue/20 bg-blue/5 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted">Recommended assignment</p>
                <p className="mt-1 text-sm font-semibold">
                  Work Order <Mono>{asText(rec.order_id)}</Mono>
                </p>
                <p className="mt-1 text-sm">
                  Worker <Mono>{asText(rec.worker_id)}</Mono>
                  {rec.robot_id ? (
                    <>
                      {" "}
                      + Robot <Mono>{asText(rec.robot_id)}</Mono>
                    </>
                  ) : null}
                  {rec.machine_id ? (
                    <>
                      {" "}
                      · Machine <Mono>{asText(rec.machine_id)}</Mono>
                    </>
                  ) : null}
                </p>
              </div>
              <Badge tone="green">Validated</Badge>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-muted">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green" /> Qualified & available
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green" /> Deterministic safety passed
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green" /> No AI self-approval
              </li>
            </ul>
            <p className="mt-3 rounded-xl bg-surface/80 p-3 text-xs leading-relaxed text-fg">{explanation}</p>
            <p className="mono mt-2 text-[10px] text-muted">
              source={source}
              {rec.model ? ` · model=${rec.model}` : ""}
              {rec.inference_request_id ? ` · request_id=${rec.inference_request_id}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {flow.currentStep === "proposal" ? (
                <Button variant="primary" loading={flow.busy.proposal} onClick={flow.createProposal}>
                  Create proposal
                </Button>
              ) : null}
              {flow.currentStep === "approval" ? (
                <Button variant="primary" loading={flow.busy.decision} onClick={() => flow.decide(true)}>
                  Approve &amp; Dispatch
                </Button>
              ) : null}
              <Link href="/orchestration" className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-4 text-sm hover:bg-elevated">
                View Details
              </Link>
            </div>
            {proposal ? (
              <p className="mono mt-3 text-[11px] text-muted">
                Proposal {String(proposal.id)} · {proposal.status}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-elevated/40 p-4 text-sm text-muted">
            No recommendation yet. Use the demo runbook to replay a machine-health event and request a safe assignment.
          </div>
        )}

        <div className="rounded-2xl border border-amber/30 bg-amber/5 p-4">
          <p className="text-xs font-semibold text-amber">Potential issue detection</p>
          <p className="mt-1 text-sm text-fg">Unqualified or unavailable resources are rejected by the safety engine before Nebius is called.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/orchestration" className="inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs">
              View Conflict Path
            </Link>
            <Button size="sm" variant="ghost" onClick={flow.recommend} loading={flow.busy.recommend} disabled={!flow.orderId}>
              Suggest Alternative
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function FloorLiveView() {
  const state = useFactoryState();
  const proposals = useProposals();
  const [mode, setMode] = React.useState<"2d" | "3d">("2d");
  const data = state.data;

  return (
    <Card className="shadow-sm xl:col-span-2" aria-label="Factory floor live view">
      <CardHeader
        title="Factory Floor Live View"
        description="Simulated stations, workers, and robots from /api/state — not a live camera feed."
        action={
          <div className="flex items-center gap-1 rounded-xl border border-line bg-elevated p-1">
            <button
              type="button"
              className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", mode === "2d" ? "bg-surface text-fg shadow-sm" : "text-muted")}
              onClick={() => setMode("2d")}
            >
              2D View
            </button>
            <button
              type="button"
              className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", mode === "3d" ? "bg-surface text-fg shadow-sm" : "text-muted")}
              onClick={() => setMode("3d")}
              title="Perspective preview of the same 2D graph"
            >
              3D View
            </button>
            <Link href="/factory" aria-label="Open fullscreen factory floor" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-fg">
              <Maximize2 className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
      />
      <CardBody className="p-0">
        <div className={cn("factory-floor relative h-[380px] overflow-hidden rounded-b-lg", mode === "3d" && "[perspective:1200px]")}>
          {state.isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : state.isError ? (
            <div className="p-4">
              <ErrorState error={state.error} onRetry={() => void state.refetch()} title="Factory state unavailable" />
            </div>
          ) : data ? (
            <div className={cn("h-full w-full", mode === "3d" && "origin-center scale-[0.92] [transform:rotateX(18deg)_rotateZ(-6deg)]")}>
              <FactoryFlow machines={data.machines} workers={data.workers} robots={data.robots} proposals={proposals.data ?? []} />
            </div>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function OrdersTable() {
  const state = useFactoryState();
  const orders = state.data?.orders ?? [];
  return (
    <Card className="shadow-sm" aria-label="Active work orders">
      <CardHeader title="Work order board" description="Priority and status from the orchestration backend" />
      <CardBody className="overflow-x-auto p-0">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">ID</th>
              <th className="px-4 py-2.5 font-medium">Product / Task</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 6).map((o) => (
              <tr key={String(o.id)} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3">
                  <Mono>{String(o.id)}</Mono>
                </td>
                <td className="px-4 py-3">{asText(o.task, "—")}</td>
                <td className="px-4 py-3">
                  <Badge tone={/high|1/i.test(String(o.priority ?? "")) ? "red" : "neutral"}>{asText(o.priority, "—")}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(o.status)} dot>
                    {asText(o.status, "planned")}
                  </Badge>
                </td>
              </tr>
            ))}
            {!orders.length ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted">
                  No work orders loaded
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}

function WorkersPanel() {
  const state = useFactoryState();
  const workers = state.data?.workers ?? [];
  return (
    <Card className="shadow-sm" aria-label="Workers">
      <CardHeader title="Workers" description="Availability from seeded factory state" />
      <CardBody className="space-y-2.5">
        {workers.slice(0, 6).map((w) => {
          const available = w.available !== false;
          return (
            <div key={String(w.id)} className="flex items-center gap-3 rounded-xl border border-line/80 px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue/10 text-[11px] font-semibold text-blue">
                {asText(w.name, "?").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{asText(w.name)}</p>
                <p className="truncate text-[11px] text-muted">{(w.skills ?? []).slice(0, 2).join(", ") || asText(w.shift, "Shift n/a")}</p>
              </div>
              <span className={cn("h-2.5 w-2.5 rounded-full", available ? "bg-green" : "bg-red")} title={available ? "Available" : "Busy"} />
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function RobotsPanel() {
  const state = useFactoryState();
  const robots = state.data?.robots ?? [];
  const machines = state.data?.machines ?? [];
  return (
    <Card className="shadow-sm" aria-label="Robots and machines">
      <CardHeader title="Robots & Machines" description="Simulated fleet status" />
      <CardBody className="space-y-2.5">
        {robots.map((r) => (
          <div key={String(r.id)} className="flex items-center gap-3 rounded-xl border border-line/80 px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet/10 text-violet">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                <Mono>{String(r.id)}</Mono> {asText(r.type)}
              </p>
              <p className="text-[11px] text-muted">{asText(r.status, r.available === false ? "Unavailable" : "Available")}</p>
            </div>
            <Badge tone={statusTone(r.status ?? (r.available === false ? "unavailable" : "available"))} dot>
              {r.available === false ? "Busy" : "Ready"}
            </Badge>
          </div>
        ))}
        {machines.slice(0, 3).map((m) => (
          <div key={String(m.id)} className="flex items-center gap-3 rounded-xl border border-line/80 px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue/10 text-blue text-[10px] font-bold">M</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{asText(m.name, String(m.id))}</p>
              <p className="text-[11px] text-muted">{asText(m.type)} · {asText(m.status)}</p>
            </div>
            <Badge tone={statusTone(m.status)}>{asText(m.status, "—")}</Badge>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function flowStageIndex(current: string | null | undefined, simulated: boolean, proposalStatus?: string): number {
  if (simulated) return 7;
  if (proposalStatus && /approv/i.test(proposalStatus)) return 5;
  switch (current) {
    case "replay":
      return 0;
    case "recommend":
      return 2;
    case "proposal":
      return 3;
    case "approval":
      return 4;
    case "simulate":
      return 5;
    case "audit":
      return 7;
    default:
      return 0;
  }
}

export function CommandCenter() {
  const state = useFactoryState();
  const health = useHealth();
  const flow = useDemoFlow();
  const down = state.isError && state.error instanceof ApiError && state.error.network;
  const nebius = resolveNebius(health.data, state.data, down);
  const data = state.data;
  const kpis = data ? normalizeKpis(data) : [];
  const stage = flowStageIndex(flow.currentStep, flow.steps.every((s) => s.status === "done") || Boolean(flow.executionId), flow.proposal?.status);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue">Seeknimbly PhysicalOS</p>
        </div>
        <Badge tone={nebius.tone} dot title={nebius.detail}>
          AI explanations: {nebius.label}
        </Badge>
      </div>

      <DemoRunbook />

      <DataFlowStrip activeIndex={stage} />

      <section aria-label="Key performance indicators">
        {state.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" role="status" aria-label="Loading KPIs">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[112px] rounded-2xl" />
            ))}
          </div>
        ) : state.isError ? (
          <Card>
            <ErrorState error={state.error} onRetry={() => void state.refetch()} title="Factory state unavailable" />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {kpis.slice(0, 5).map((k, i) => (
              <KpiCard
                key={k.key}
                label={k.label}
                value={k.value}
                hint={k.hint}
                derived={k.derived}
                tone={(k.tone as Tone | undefined) ?? "blue"}
                icon={KPI_ICONS[i % KPI_ICONS.length]}
              />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <FloorLiveView />
        <AiRecommendationPanel />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <OrdersTable />
        <WorkersPanel />
        <RobotsPanel />
      </div>
    </div>
  );
}
