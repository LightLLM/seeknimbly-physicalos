"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CircleDashed, ClipboardList, Play, RotateCcw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFactoryState } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { useDemoFlow, type FlowStep, type StepStatus } from "./demo-flow";

const statusStyle: Record<StepStatus, string> = {
  todo: "border-line text-muted",
  active: "border-teal bg-teal/10 text-teal pulse-ring",
  done: "border-green/60 bg-green/15 text-green",
  error: "border-red/60 bg-red/15 text-red",
};

function StepIcon({ step, index }: { step: FlowStep; index: number }) {
  if (step.status === "done") return <Check className="h-3.5 w-3.5" />;
  if (step.status === "error") return <X className="h-3.5 w-3.5" />;
  if (step.status === "active") return <span className="mono text-[11px] font-semibold">{index + 1}</span>;
  return <CircleDashed className="h-3.5 w-3.5" />;
}

/**
 * The primary demo path: Replay event → Recommend → Create proposal → Approve → Simulate → Audit.
 * Every action calls the real backend; nothing here fakes a result.
 */
export function DemoRunbook({ compact = false }: { compact?: boolean }) {
  const flow = useDemoFlow();
  const factory = useFactoryState();
  const [udiText, setUdiText] = React.useState("");
  const orders = factory.data?.orders ?? [];
  const parsedUdi = udiText.trim() === "" ? undefined : Number(udiText);
  const udiInvalid = parsedUdi !== undefined && (!Number.isInteger(parsedUdi) || parsedUdi < 1);

  let action: React.ReactNode = null;
  switch (flow.currentStep) {
    case "replay":
      action = (
        <Button variant="primary" loading={flow.busy.replay} disabled={udiInvalid} onClick={() => flow.replay(parsedUdi)}>
          <Play className="h-4 w-4" /> {parsedUdi === undefined ? "Replay first failure" : `Replay UDI ${parsedUdi}`}
        </Button>
      );
      break;
    case "recommend":
      action = (
        <Button variant="primary" loading={flow.busy.recommend} disabled={!flow.orderId} onClick={flow.recommend}>
          <ClipboardList className="h-4 w-4" /> Request recommendation
        </Button>
      );
      break;
    case "proposal":
      action = (
        <Button variant="primary" loading={flow.busy.proposal} onClick={flow.createProposal}>
          <ClipboardList className="h-4 w-4" /> Create proposal
        </Button>
      );
      break;
    case "approval":
      action = (
        <>
          <Button variant="success" loading={flow.busy.decision} onClick={() => flow.decide(true)}>
            <Check className="h-4 w-4" /> Approve
          </Button>
          <Button variant="danger" disabled={flow.busy.decision} onClick={() => flow.decide(false)}>
            <X className="h-4 w-4" /> Reject
          </Button>
        </>
      );
      break;
    case "simulate":
      action = (
        <Button variant="primary" loading={flow.busy.simulate} onClick={flow.simulate}>
          <Play className="h-4 w-4" /> Simulate dispatch
        </Button>
      );
      break;
    case "audit":
      action = (
        <Link href="/audit" className="inline-flex h-9 items-center gap-2 rounded-md bg-teal px-4 text-sm font-semibold text-[#041512] hover:bg-teal/85">
          <ShieldCheck className="h-4 w-4" /> View audit trail
        </Link>
      );
      break;
    default:
      action = null;
  }

  const finished = flow.steps.every((s) => s.status === "done");
  const rejected = flow.steps.some((s) => s.status === "error");

  return (
    <Card aria-label="Demo runbook">
      <CardHeader
        title="Demo runbook"
        description="Replay event → recommend → create proposal → approve → simulate → audit. Simulation only; no physical robot is commanded."
        action={
          <>
            <Badge tone="amber" dot>
              Simulation Mode
            </Badge>
            <Button size="sm" variant="ghost" onClick={flow.resetFlow} aria-label="Restart runbook">
              <RotateCcw className="h-3.5 w-3.5" /> Restart
            </Button>
          </>
        }
      />
      <CardBody className="space-y-4">
        {!compact ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="runbook-order">Work order</Label>
              <Select id="runbook-order" value={flow.orderId ?? ""} onChange={(e) => flow.setOrderId(e.target.value)} disabled={!orders.length}>
                {orders.length === 0 ? <option value="">No orders loaded</option> : null}
                {orders.map((o) => (
                  <option key={String(o.id)} value={String(o.id)}>
                    {String(o.id)} — {o.task ?? "order"}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="runbook-udi">AI4I UDI to replay (optional)</Label>
              <Input
                id="runbook-udi"
                inputMode="numeric"
                placeholder="blank = first failure"
                value={udiText}
                onChange={(e) => setUdiText(e.target.value)}
                aria-invalid={udiInvalid}
              />
              {udiInvalid ? <p className="mt-1 text-xs text-red">UDI must be a positive integer.</p> : null}
            </div>
          </div>
        ) : null}

        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {flow.steps.map((step, i) => (
            <li
              key={step.key}
              className={cn("rounded-md border bg-elevated/50 p-2.5", step.status === "active" ? "border-teal/60" : "border-line")}
              aria-current={step.status === "active" ? "step" : undefined}
            >
              <div className="flex items-center gap-2">
                <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border", statusStyle[step.status])}>
                  <StepIcon step={step} index={i} />
                </span>
                <span className="text-xs font-semibold">{step.label}</span>
              </div>
              <p className="mono mt-1.5 truncate text-[11px] text-muted" title={step.detail}>
                {step.detail}
              </p>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          {action}
          {finished ? <span className="text-xs text-green">Flow complete — review the audit trail.</span> : null}
          {rejected ? <span className="text-xs text-red">Proposal was rejected. Restart to run the flow again.</span> : null}
          {flow.currentStep === "approval" ? <span className="text-xs text-muted">Mutating calls need the Demo Admin Token (Settings) when the backend enforces one.</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}
