"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Json, Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/states";
import { ProposalActions } from "@/components/demo/proposal-actions";
import { DemoRunbook } from "@/components/demo/runbook";
import { useProposals } from "@/lib/api/hooks";
import type { Proposal } from "@/lib/api/schemas";
import { cn, formatTimestamp } from "@/lib/utils";

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

export function ApprovalsPage() {
  const proposals = useProposals();
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [selectedId, setSelectedId] = React.useState<string | undefined>();

  const all = React.useMemo(() => proposals.data ?? [], [proposals.data]);
  const counts = React.useMemo(() => {
    const c: Record<Filter, number> = { all: all.length, pending: 0, approved: 0, rejected: 0 };
    for (const p of all) {
      const s = p.status.toLowerCase();
      if (s === "pending" || s === "approved" || s === "rejected") c[s] += 1;
    }
    return c;
  }, [all]);
  const rows = filter === "all" ? all : all.filter((p) => p.status.toLowerCase() === filter);
  const selected = all.find((p) => String(p.id) === selectedId);

  const columns = React.useMemo<ColumnDef<Proposal, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Proposal", cell: (c) => <Mono className="text-sm">#{String(c.row.original.id)}</Mono> },
      { accessorKey: "order_id", header: "Order", cell: (c) => <Mono className="text-sm">{String(c.row.original.order_id)}</Mono> },
      { accessorKey: "worker_id", header: "Worker", cell: (c) => <Mono className="text-sm">{String(c.row.original.worker_id)}</Mono> },
      { accessorKey: "robot_id", header: "Robot", cell: (c) => <Mono className="text-sm">{String(c.row.original.robot_id)}</Mono> },
      {
        accessorKey: "source",
        header: "Source",
        cell: (c) => <Badge tone={c.row.original.source === "rules" ? "neutral" : "violet"}>{c.row.original.source ?? "—"}</Badge>,
      },
      { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.row.original.status} /> },
      { accessorKey: "created_at", header: "Created", cell: (c) => <Mono className="text-muted">{formatTimestamp(c.row.original.created_at)}</Mono> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: (c) => (
          <div onClick={(e) => e.stopPropagation()}>
            <ProposalActions proposal={c.row.original} />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Approvals" description="Every robot-assisted assignment needs a supervisor decision. Decisions are recorded in the audit trail." />
      <DemoRunbook compact />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <div role="tablist" aria-label="Proposal status" className="flex gap-1 border-b border-line px-3 pt-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn("-mb-px border-b-2 px-3 py-2 text-xs font-medium capitalize", filter === f ? "border-teal text-fg" : "border-transparent text-muted hover:text-fg")}
              >
                {f} <span className="mono ml-1 text-[10px] text-muted">{counts[f]}</span>
              </button>
            ))}
          </div>
          <QueryBoundary query={proposals}>
            <DataTable
              key={filter}
              data={rows}
              columns={columns}
              getRowId={(p) => String(p.id)}
              selectedRowId={selectedId}
              onRowClick={(p) => setSelectedId(String(p.id))}
              initialSorting={[{ id: "id", desc: true }]}
              emptyTitle={filter === "pending" ? "No pending approvals" : `No ${filter} proposals`}
              emptyDescription="Request a recommendation and create a proposal from the runbook above."
            />
          </QueryBoundary>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Proposal detail" description={selected ? `Proposal #${String(selected.id)}` : "Select a row"} />
          <CardBody>
            {selected ? (
              <div className="space-y-3">
                <StatusBadge status={selected.status} />
                <p className="rounded-md border border-line bg-elevated/50 p-3 text-sm leading-6">{selected.rationale ?? "No rationale recorded."}</p>
                {selected.model ? (
                  <p className="text-xs text-muted">
                    Model <Mono>{selected.model}</Mono>
                  </p>
                ) : null}
                <Json value={selected} />
                <ProposalActions proposal={selected} size="md" />
              </div>
            ) : (
              <p className="text-sm text-muted">Select a proposal to review its rationale and raw record.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
