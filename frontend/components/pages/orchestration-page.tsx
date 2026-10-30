"use client";

import * as React from "react";
import { Check, ClipboardList, Play, Radio, Sparkles, X } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Json, Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { Select, Label } from "@/components/ui/input";
import { EmptyState, QueryBoundary } from "@/components/ui/states";
import { EventRow } from "@/components/demo/feeds";
import { DemoRunbook } from "@/components/demo/runbook";
import { useDemoFlow } from "@/components/demo/demo-flow";
import { WorkflowFlow } from "@/components/flow/dynamic";
import type { StageNodeInput } from "@/components/flow/workflow-flow";
import { useEvents, useFactoryState, useWorkflow } from "@/lib/api/hooks";
import { eventKey, workflowStages } from "@/lib/normalize";
import { asText } from "@/lib/utils";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

export function OrchestrationPage() {
  const flow = useDemoFlow();
  const events = useEvents();
  const factory = useFactoryState();
  const workflow = useWorkflow(flow.workflowId);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const eventList = events.data ?? [];
  const selectedIndex = eventList.findIndex((e, i) => eventKey(e, i) === selectedKey);
  const selectedEvent = selectedIndex >= 0 ? eventList[selectedIndex] : undefined;
  const replayUdi = selectedEvent?.udi ?? undefined;

  const backendStages = workflowStages(workflow.data);
  const stages: StageNodeInput[] = backendStages.length
    ? backendStages.map((s) => ({ id: s.id, label: s.label, status: s.status }))
    : flow.steps.map((s) => ({ id: s.key, label: s.label, status: s.status, detail: s.detail }));

  const rec = flow.recommendation;
  const worker = rec ? factory.data?.workers.find((w) => String(w.id) === String(rec.worker_id)) : undefined;
  const proposalStatus = flow.proposal?.status.toLowerCase();
  const canApprove = proposalStatus === "pending";
  const canSimulate = proposalStatus === "approved" && flow.steps.find((s) => s.key === "simulate")?.status !== "done";

  return (
    <div className="space-y-5">
      <PageHeader title="Orchestration" description="Detect → recommend → propose → approve → simulate → audit. Deterministic safety checks always prevail over AI suggestions." />
      <DemoRunbook compact />

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
        {/* Left: events */}
        <Card className="h-fit">
          <CardHeader title="Events" description="Select an event, then replay it" action={<Radio className="h-4 w-4 text-muted" />} />
          <QueryBoundary query={events} rows={4}>
            {eventList.length === 0 ? (
              <EmptyState title="No events" description="Replay the first failure to inject a machine fault into the workflow." />
            ) : (
              <ul className="max-h-[420px] space-y-2 overflow-y-auto p-3">
                {eventList.map((e, i) => {
                  const key = eventKey(e, i);
                  return (
                    <li key={key}>
                      <EventRow event={e} selected={key === selectedKey} onClick={() => setSelectedKey(key === selectedKey ? null : key)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryBoundary>
          <div className="flex flex-wrap gap-2 border-t border-line p-3">
            <Button size="sm" variant="primary" loading={flow.busy.replay} onClick={() => flow.replay(replayUdi ?? undefined)}>
              <Play className="h-3.5 w-3.5" /> {replayUdi !== undefined ? `Replay UDI ${replayUdi}` : "Replay first failure"}
            </Button>
          </div>
        </Card>

        {/* Center: workflow stages */}
        <Card className="min-w-0">
          <CardHeader
            title="Workflow stages"
            description={backendStages.length ? `Backend workflow ${asText(flow.workflowId)}` : "Derived from this session's actions"}
            action={workflow.data?.status ? <StatusBadge status={workflow.data.status} /> : null}
          />
          <div className="blueprint h-[640px]" aria-label="Workflow stages diagram">
            <WorkflowFlow stages={stages} />
          </div>
        </Card>

        {/* Right: inspector */}
        <Card className="h-fit">
          <CardHeader title="Recommendation inspector" description="Review before anything is dispatched" action={<Sparkles className="h-4 w-4 text-muted" />} />
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="inspector-order">Work order</Label>
              <Select id="inspector-order" value={flow.orderId ?? ""} onChange={(e) => flow.setOrderId(e.target.value)} disabled={!factory.data?.orders.length}>
                {(factory.data?.orders ?? []).map((o) => (
                  <option key={String(o.id)} value={String(o.id)}>
                    {String(o.id)} — {o.task ?? "order"}
                  </option>
                ))}
              </Select>
            </div>

            {rec ? (
              <dl className="divide-y divide-line/60 rounded-md border border-line px-3">
                <Field label="Worker">
                  <span className="font-medium">{worker?.name ?? "—"}</span> <Mono className="text-muted">#{String(rec.worker_id)}</Mono>
                </Field>
                <Field label="Robot (simulated)">
                  <Mono className="text-sm">{String(rec.robot_id)}</Mono>
                </Field>
                {rec.machine_id !== undefined && rec.machine_id !== null ? (
                  <Field label="Machine">
                    <Mono className="text-sm">{String(rec.machine_id)}</Mono>
                  </Field>
                ) : null}
                <Field label="Source">
                  <Badge tone={rec.source === "rules" ? "neutral" : "violet"}>{rec.source}</Badge>
                </Field>
                {rec.model ? (
                  <Field label="Model">
                    <Mono>{rec.model}</Mono>
                  </Field>
                ) : null}
                {rec.inference_request_id ? (
                  <Field label="Inference ID">
                    <Mono>{rec.inference_request_id}</Mono>
                  </Field>
                ) : null}
              </dl>
            ) : (
              <EmptyState icon={ClipboardList} title="No recommendation yet" description="Request a recommendation for the selected work order. The backend validates eligibility deterministically." />
            )}

            {rec ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted">Rationale</p>
                <p className="rounded-md border border-line bg-elevated/50 p-3 text-sm leading-6">{rec.rationale}</p>
                {rec.source === "rules" ? <p className="mt-1.5 text-xs text-muted">Deterministic rules only — no Nebius explanation was used for this recommendation.</p> : null}
              </div>
            ) : null}
            {rec?.safety_checks ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted">Safety checks</p>
                <Json value={rec.safety_checks} />
              </div>
            ) : null}

            <div className="space-y-2 border-t border-line pt-4">
              <div className="flex flex-wrap gap-2">
                <Button loading={flow.busy.recommend} disabled={!flow.orderId} onClick={flow.recommend}>
                  <Sparkles className="h-4 w-4" /> {rec ? "Re-run" : "Recommend"}
                </Button>
                <Button variant="primary" loading={flow.busy.proposal} disabled={!rec || flow.proposal !== undefined} onClick={flow.createProposal}>
                  <ClipboardList className="h-4 w-4" /> Create proposal
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="success" disabled={!canApprove || flow.busy.decision} onClick={() => flow.decide(true)}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button variant="danger" disabled={!canApprove || flow.busy.decision} onClick={() => flow.decide(false)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button loading={flow.busy.simulate} disabled={!canSimulate} onClick={flow.simulate}>
                  <Play className="h-4 w-4" /> Simulate
                </Button>
              </div>
              {flow.proposal ? (
                <p className="flex items-center gap-2 text-xs text-muted">
                  Proposal <Mono>#{String(flow.proposal.id)}</Mono> <StatusBadge status={flow.proposal.status} />
                </p>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
