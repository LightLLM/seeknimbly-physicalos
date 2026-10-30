"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Json, Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/input";
import { QueryBoundary } from "@/components/ui/states";
import { useAudit } from "@/lib/api/hooks";
import type { AuditEntry } from "@/lib/api/schemas";
import { asText, formatTimestamp, parseMaybeJson, statusTone } from "@/lib/utils";

export function AuditPage() {
  const audit = useAudit();
  const [action, setAction] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | undefined>();

  const all = React.useMemo(() => audit.data ?? [], [audit.data]);
  const actions = React.useMemo(() => [...new Set(all.map((a) => a.action))].sort(), [all]);
  const rows = action === "all" ? all : all.filter((a) => a.action === action);
  const selected = all.find((a) => String(a.id) === selectedId);

  const columns = React.useMemo<ColumnDef<AuditEntry, unknown>[]>(
    () => [
      { accessorKey: "id", header: "#", cell: (c) => <Mono className="text-sm">{String(c.row.original.id)}</Mono> },
      { accessorKey: "created_at", header: "Timestamp", cell: (c) => <Mono className="text-muted">{formatTimestamp(c.row.original.created_at)}</Mono> },
      { accessorKey: "action", header: "Action", cell: (c) => <Badge tone={statusTone(c.row.original.action)}>{c.row.original.action}</Badge> },
      { accessorKey: "actor", header: "Actor", cell: (c) => asText(c.row.original.actor, "system") },
      {
        id: "detail",
        header: "Detail",
        enableSorting: false,
        accessorFn: (a) => asText(parseMaybeJson(a.detail), ""),
        cell: (c) => <span className="mono block max-w-[360px] truncate text-[11px] text-muted">{String(c.getValue())}</span>,
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail"
        description="Append-only record of proposals, decisions and simulated executions. Times are UTC."
        actions={
          <div className="w-52">
            <Select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="all">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card>
          <QueryBoundary query={audit}>
            <DataTable
              data={rows}
              columns={columns}
              pageSize={15}
              getRowId={(a) => String(a.id)}
              selectedRowId={selectedId}
              onRowClick={(a) => setSelectedId(String(a.id))}
              initialSorting={[{ id: "id", desc: true }]}
              emptyTitle="No audit entries"
              emptyDescription="Run the demo flow — creating, approving and simulating a proposal each write an entry."
            />
          </QueryBoundary>
        </Card>
        <Card className="h-fit">
          <CardHeader title="Entry detail" description={selected ? `Entry #${String(selected.id)}` : "Select a row"} />
          <CardBody>
            {selected ? (
              <div className="space-y-3">
                <Badge tone={statusTone(selected.action)}>{selected.action}</Badge>
                <p className="text-xs text-muted">
                  <Mono>{formatTimestamp(selected.created_at)}</Mono>
                </p>
                <Json value={parseMaybeJson(selected.detail) ?? "(no detail)"} />
              </div>
            ) : (
              <p className="text-sm text-muted">Select an entry to inspect its full payload.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
