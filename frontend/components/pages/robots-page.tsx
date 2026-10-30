"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { KpiCard } from "@/components/ui/kpi-card";
import { Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/states";
import { useRobots } from "@/lib/api/hooks";
import type { Robot } from "@/lib/api/schemas";
import { asText, formatNumber } from "@/lib/utils";

const columns: ColumnDef<Robot, unknown>[] = [
  { accessorKey: "id", header: "ID", cell: (c) => <Mono className="text-sm">{String(c.row.original.id)}</Mono> },
  { accessorKey: "type", header: "Type", cell: (c) => <Badge tone="blue">{asText(c.row.original.type)}</Badge> },
  {
    id: "availability",
    header: "Availability",
    accessorFn: (r) => r.status ?? (r.available === false ? "unavailable" : "available"),
    cell: (c) => <StatusBadge status={c.getValue()} />,
  },
  { accessorKey: "location", header: "Location", cell: (c) => asText(c.row.original.location) },
  { id: "battery", header: "Battery", accessorFn: (r) => r.battery, cell: (c) => <Mono className="text-sm">{c.getValue() === undefined || c.getValue() === null ? "—" : `${formatNumber(c.getValue(), 0)}%`}</Mono> },
];

export function RobotsPage() {
  const robots = useRobots();
  const list = robots.data ?? [];
  const available = list.filter((r) => r.available !== false).length;
  const types = [...new Set(list.map((r) => r.type).filter(Boolean))];

  return (
    <div className="space-y-5">
      <PageHeader title="Robots" description="Simulated robot fleet. Commands issued from this console never reach physical hardware." />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Fleet size" value={String(list.length)} tone="violet" />
        <KpiCard label="Available" value={`${available} / ${list.length}`} tone="green" />
        <KpiCard label="Robot types" value={String(types.length)} hint={types.join(", ")} tone="blue" />
      </div>
      <Card>
        <QueryBoundary query={robots}>
          <DataTable data={list} columns={columns} getRowId={(r) => String(r.id)} emptyTitle="No robots" emptyDescription="The backend returned no robots." />
        </QueryBoundary>
      </Card>
    </div>
  );
}
