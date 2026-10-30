"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Json, Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, LoadingRows, QueryBoundary } from "@/components/ui/states";
import { DemoRunbook } from "@/components/demo/runbook";
import { describeError } from "@/lib/api/client";
import { useExecution, useExecutions, useSimulateWorkflow, useWorkflows } from "@/lib/api/hooks";
import type { Execution, Workflow } from "@/lib/api/schemas";
import { executionSteps } from "@/lib/normalize";
import { asText, formatTimestamp, pick } from "@/lib/utils";

export function ExecutionsPage() {
  const executions = useExecutions();
  const workflows = useWorkflows();
  const simulate = useSimulateWorkflow();
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const detail = useExecution(selectedId);

  const runSimulation = (w: Workflow) =>
    simulate.mutate(w.id, {
      onSuccess: () => toast.success(`Workflow ${w.id} simulated`, { description: "Simulation only — no physical robot was commanded." }),
      onError: (e) => toast.error("Simulation failed", { description: describeError(e) }),
    });

  const executionColumns = React.useMemo<ColumnDef<Execution, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Execution", cell: (c) => <Mono className="text-sm">{String(c.row.original.id)}</Mono> },
      { accessorKey: "workflow_id", header: "Workflow", cell: (c) => <Mono className="text-sm">{asText(c.row.original.workflow_id)}</Mono> },
      { accessorKey: "proposal_id", header: "Proposal", cell: (c) => <Mono className="text-sm">{asText(c.row.original.proposal_id)}</Mono> },
      { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.row.original.status ?? "unknown"} /> },
      {
        id: "mode",
        header: "Mode",
        accessorFn: (x) => (x.simulated === false ? "live" : "simulated"),
        cell: (c) => <Badge tone={c.getValue() === "live" ? "red" : "blue"}>{String(c.getValue())}</Badge>,
      },
      {
        id: "started",
        header: "Started",
        accessorFn: (x) => pick<string>(x, "started_at", "created_at"),
        cell: (c) => <Mono className="text-muted">{formatTimestamp(c.getValue())}</Mono>,
      },
    ],
    [],
  );

  const workflowColumns: ColumnDef<Workflow, unknown>[] = [
      { accessorKey: "id", header: "Workflow", cell: (c) => <Mono className="text-sm">{String(c.row.original.id)}</Mono> },
      { id: "name", header: "Name", accessorFn: (w) => w.name ?? `Workflow ${w.id}`, cell: (c) => String(c.getValue()) },
      { accessorKey: "order_id", header: "Order", cell: (c) => <Mono className="text-sm">{asText(c.row.original.order_id)}</Mono> },
      {
        id: "status",
        header: "Status",
        accessorFn: (w) => pick<string>(w, "status", "state", "current_stage") ?? "unknown",
        cell: (c) => <StatusBadge status={c.getValue()} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: (c) => (
          <Button size="sm" loading={simulate.isPending && simulate.variables === c.row.original.id} disabled={simulate.isPending} onClick={() => runSimulation(c.row.original)}>
            <Play className="h-3.5 w-3.5" /> Simulate
          </Button>
        ),
      },
  ];

  const steps = executionSteps(detail.data);

  return (
    <div className="space-y-5">
      <PageHeader title="Executions" description="Simulated dispatch runs. Executions here never command physical robots; each is recorded for audit." />
      <DemoRunbook compact />

      <Card>
        <CardHeader title="Workflows ready to simulate" description="Approved proposals create workflows the simulator can run" />
        <QueryBoundary query={workflows} rows={3}>
          <DataTable data={workflows.data ?? []} columns={workflowColumns} getRowId={(w) => String(w.id)} emptyTitle="No workflows" emptyDescription="Replay an event and approve a proposal to produce a workflow." />
        </QueryBoundary>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title="Execution history" />
          <QueryBoundary query={executions}>
            <DataTable
              data={executions.data ?? []}
              columns={executionColumns}
              getRowId={(x) => String(x.id)}
              selectedRowId={selectedId}
              onRowClick={(x) => setSelectedId(String(x.id))}
              initialSorting={[{ id: "id", desc: true }]}
              emptyTitle="No executions yet"
              emptyDescription="Simulate an approved workflow to record the first execution."
            />
          </QueryBoundary>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Execution detail" description={selectedId ? `Execution ${selectedId}` : "Select an execution"} />
          <CardBody>
            {!selectedId ? (
              <EmptyState title="No execution selected" description="Choose a row to see its steps and raw result." />
            ) : detail.isLoading ? (
              <LoadingRows rows={3} />
            ) : detail.isError ? (
              <p className="text-sm text-red">{describeError(detail.error)}</p>
            ) : detail.data ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={detail.data.status ?? "unknown"} />
                  <Badge tone="blue">{detail.data.simulated === false ? "live" : "simulated"}</Badge>
                </div>
                {steps.length ? (
                  <ol className="space-y-2">
                    {steps.map((s) => (
                      <li key={s.id} className="flex items-center justify-between rounded-md border border-line px-3 py-2 text-sm">
                        <span>{s.label}</span>
                        <StatusBadge status={s.status} />
                      </li>
                    ))}
                  </ol>
                ) : null}
                <Json value={detail.data} />
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
