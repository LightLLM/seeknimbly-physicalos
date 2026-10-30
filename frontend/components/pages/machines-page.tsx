"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/states";
import { useMachines } from "@/lib/api/hooks";
import type { Machine } from "@/lib/api/schemas";
import { asText, formatNumber, pick } from "@/lib/utils";

const columns: ColumnDef<Machine, unknown>[] = [
  { accessorKey: "id", header: "ID", cell: (c) => <Mono className="text-sm">{String(c.row.original.id)}</Mono> },
  { id: "name", header: "Name", accessorFn: (m) => m.name ?? `Machine ${m.id}`, cell: (c) => <span className="font-medium">{String(c.getValue())}</span> },
  { accessorKey: "type", header: "Type", cell: (c) => asText(c.row.original.type) },
  { accessorKey: "line", header: "Line", cell: (c) => asText(c.row.original.line) },
  { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.row.original.status ?? "unknown"} /> },
  {
    id: "health",
    header: "Health",
    accessorFn: (m) => pick<number | string>(m, "health_score", "health", "risk"),
    cell: (c) => <Mono className="text-sm">{formatNumber(c.getValue())}</Mono>,
  },
  { id: "wear", header: "Tool wear (min)", accessorFn: (m) => m.tool_wear, cell: (c) => <Mono className="text-sm">{formatNumber(c.getValue())}</Mono> },
  { accessorKey: "product_id", header: "Last product", cell: (c) => <Mono>{asText(c.row.original.product_id)}</Mono> },
];

const AT_RISK = /(fail|fault|warn|risk|degrad|down)/i;

export function MachinesPage() {
  const machines = useMachines();
  const list = machines.data ?? [];
  const atRisk = list.filter((m) => AT_RISK.test(String(m.status ?? ""))).length;

  return (
    <div className="space-y-5">
      <PageHeader title="Machines" description="Equipment health and fault state. Failure events replayed from the AI4I dataset surface here." />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Machines tracked" value={String(list.length)} tone="blue" />
        <KpiCard label="Healthy" value={String(list.length - atRisk)} tone="green" />
        <KpiCard label="At risk / faulted" value={String(atRisk)} tone={atRisk ? "red" : "teal"} />
      </div>
      <Card>
        <QueryBoundary query={machines}>
          <DataTable
            data={list}
            columns={columns}
            getRowId={(m) => String(m.id)}
            emptyTitle="No machines reported"
            emptyDescription="The backend returned no machines. Import the dataset or reset the demo to seed equipment."
          />
        </QueryBoundary>
      </Card>
    </div>
  );
}
