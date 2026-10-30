"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/states";
import { useFactoryState } from "@/lib/api/hooks";
import type { Worker } from "@/lib/api/schemas";
import { asText } from "@/lib/utils";

const columns: ColumnDef<Worker, unknown>[] = [
  { accessorKey: "id", header: "ID", cell: (c) => <Mono className="text-sm">{String(c.row.original.id)}</Mono> },
  { accessorKey: "name", header: "Name", cell: (c) => <span className="font-medium">{asText(c.row.original.name)}</span> },
  {
    id: "skills",
    header: "Skills",
    enableSorting: false,
    accessorFn: (w) => w.skills.join(", "),
    cell: (c) => (
      <div className="flex flex-wrap gap-1">
        {c.row.original.skills.map((s) => (
          <Badge key={s} tone="violet">
            {s}
          </Badge>
        ))}
      </div>
    ),
  },
  {
    id: "certs",
    header: "Certifications",
    accessorFn: (w) => (w.certifications ?? []).join(", "),
    cell: (c) => (c.row.original.certifications?.length ? <span className="text-xs">{c.row.original.certifications.join(", ")}</span> : <span className="text-xs text-muted">—</span>),
  },
  { accessorKey: "shift", header: "Shift", cell: (c) => asText(c.row.original.shift) },
  {
    id: "availability",
    header: "Availability",
    accessorFn: (w) => (w.available === false ? "unavailable" : "available"),
    cell: (c) => <StatusBadge status={c.getValue()} />,
  },
];

export function WorkforcePage() {
  const state = useFactoryState();
  const workers = React.useMemo(() => state.data?.workers ?? [], [state.data]);

  const coverage = React.useMemo(() => {
    const map = new Map<string, { total: number; available: number }>();
    for (const w of workers) {
      for (const s of w.skills) {
        const cur = map.get(s) ?? { total: 0, available: 0 };
        cur.total += 1;
        if (w.available !== false) cur.available += 1;
        map.set(s, cur);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].available - b[1].available);
  }, [workers]);

  return (
    <div className="space-y-5">
      <PageHeader title="Workforce" description="Human operators, their skills and current availability. Dispatch only considers available, qualified workers." />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card>
          <QueryBoundary query={state}>
            <DataTable data={workers} columns={columns} getRowId={(w) => String(w.id)} emptyTitle="No workers" emptyDescription="The backend returned no workers." />
          </QueryBoundary>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Skill coverage" description="Available / total workers per skill (thinnest first)" />
          <CardBody className="space-y-3">
            {coverage.length === 0 ? <p className="text-sm text-muted">No skills reported.</p> : null}
            {coverage.map(([skill, c]) => (
              <div key={skill}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{skill}</span>
                  <Mono className={c.available === 0 ? "text-red" : "text-muted"}>
                    {c.available}/{c.total}
                  </Mono>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                  <div className={c.available === 0 ? "h-full bg-red" : "h-full bg-teal"} style={{ width: `${c.total ? (c.available / c.total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
