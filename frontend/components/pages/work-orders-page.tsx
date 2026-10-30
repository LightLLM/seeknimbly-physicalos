"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/states";
import { DemoRunbook } from "@/components/demo/runbook";
import { useDemoFlow } from "@/components/demo/demo-flow";
import { useFactoryState } from "@/lib/api/hooks";
import type { Order } from "@/lib/api/schemas";
import { asText, formatTimestamp, pick } from "@/lib/utils";

export function WorkOrdersPage() {
  const state = useFactoryState();
  const flow = useDemoFlow();
  const router = useRouter();
  const workers = state.data?.workers;

  const columns = React.useMemo<ColumnDef<Order, unknown>[]>(
    () => [
      { accessorKey: "id", header: "Order", cell: (c) => <Mono className="text-sm">{String(c.row.original.id)}</Mono> },
      { accessorKey: "task", header: "Task", cell: (c) => <span className="font-medium">{asText(c.row.original.task)}</span> },
      { accessorKey: "skill", header: "Required skill", cell: (c) => <Badge tone="violet">{asText(c.row.original.skill)}</Badge> },
      { accessorKey: "robot_type", header: "Robot type", cell: (c) => <Badge tone="blue">{asText(c.row.original.robot_type)}</Badge> },
      {
        id: "qualified",
        header: "Qualified workers",
        accessorFn: (o) => (workers ?? []).filter((w) => w.available !== false && o.skill && w.skills.includes(o.skill)).length,
        cell: (c) => <Mono className="text-sm">{workers ? String(c.getValue()) : "—"}</Mono>,
      },
      { accessorKey: "priority", header: "Priority", cell: (c) => asText(c.row.original.priority) },
      {
        accessorKey: "status",
        header: "Status",
        cell: (c) => <StatusBadge status={c.row.original.status ?? "open"} />,
      },
      {
        id: "deadline",
        header: "Deadline",
        accessorFn: (o) => pick<string>(o, "deadline", "due_at"),
        cell: (c) => <Mono className="text-muted">{formatTimestamp(c.getValue())}</Mono>,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: (c) => (
          <Button
            size="sm"
            onClick={() => {
              flow.setOrderId(String(c.row.original.id));
              router.push("/orchestration");
            }}
          >
            Plan <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        ),
      },
    ],
    [workers, flow, router],
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Work Orders" description="Open production tasks with the skills and robot types they require. Select an order to plan it in Orchestration." />
      <Card>
        <QueryBoundary query={state}>
          <DataTable data={state.data?.orders ?? []} columns={columns} getRowId={(o) => String(o.id)} emptyTitle="No work orders" emptyDescription="The backend returned no open orders." />
        </QueryBoundary>
      </Card>
      <DemoRunbook compact />
    </div>
  );
}
