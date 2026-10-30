"use client";

import * as React from "react";
import { Bot, Cog, User } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Json } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { FactoryFlow } from "@/components/flow/dynamic";
import type { EntityData } from "@/components/flow/factory-flow";
import { useFactoryState, useMachines, useProposals, useRobots } from "@/lib/api/hooks";

export function FactoryPage() {
  const state = useFactoryState();
  const machines = useMachines();
  const robots = useRobots();
  const proposals = useProposals();
  const [selected, setSelected] = React.useState<EntityData | null>(null);

  const loading = state.isLoading || machines.isLoading || robots.isLoading;
  const error = state.error ?? machines.error ?? robots.error;
  const workers = state.data?.workers ?? [];
  const machineList = machines.data ?? [];
  const robotList = robots.data ?? [];
  const empty = !loading && !error && workers.length + machineList.length + robotList.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Factory Floor"
        description="Machines, workers and robots as a live topology. Dashed amber links are pending proposals; solid green links are approved assignments."
        actions={
          <>
            <Badge tone="blue"><Cog className="h-3 w-3" /> {machineList.length} machines</Badge>
            <Badge tone="teal"><User className="h-3 w-3" /> {workers.length} workers</Badge>
            <Badge tone="violet"><Bot className="h-3 w-3" /> {robotList.length} robots</Badge>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="blueprint relative h-[640px]">
            {loading ? (
              <LoadingRows rows={6} label="Loading factory topology" />
            ) : error ? (
              <ErrorState error={error} onRetry={() => { void state.refetch(); void machines.refetch(); void robots.refetch(); }} />
            ) : empty ? (
              <EmptyState title="No factory entities" description="The backend returned no machines, workers or robots." />
            ) : (
              <FactoryFlow machines={machineList} workers={workers} robots={robotList} proposals={proposals.data ?? []} onSelect={setSelected} />
            )}
            <p className="pointer-events-none absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-widest text-muted">Machines → Workers → Robots</p>
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Inspector" description="Click a node to inspect it" />
          <CardBody>
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{selected.title}</p>
                  <StatusBadge status={selected.status} />
                </div>
                <p className="mono text-xs text-muted">{selected.subtitle}</p>
                <Json value={selected.raw} />
              </div>
            ) : (
              <p className="text-sm text-muted">No node selected. Machines flow into workers, workers into robots, when proposals link them.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
