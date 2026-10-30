"use client";

import { Activity, Bot, ClipboardList, Cog, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { ErrorState, LoadingRows } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DemoRunbook } from "@/components/demo/runbook";
import { PendingApprovalsCard, RecentAuditCard, RecentEventsCard } from "@/components/demo/feeds";
import { useFactoryState, useHealth } from "@/lib/api/hooks";
import { resolveNebius, normalizeKpis } from "@/lib/normalize";
import { ApiError } from "@/lib/api/client";
import type { Tone } from "@/lib/utils";

const KPI_TONES: Tone[] = ["teal", "violet", "amber", "blue", "green", "red"];
const KPI_ICONS = [ClipboardList, Users, Bot, Cog, Activity, Activity];

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="mono">
          {value}/{total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-elevated" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CommandCenter() {
  const state = useFactoryState();
  const health = useHealth();
  const down = state.isError && state.error instanceof ApiError && state.error.network;
  const nebius = resolveNebius(health.data, state.data, down);
  const data = state.data;
  const kpis = data ? normalizeKpis(data) : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Command Center"
        description="Live supervisor view of the factory: signals, decisions awaiting you, and the audit trail. All dispatch runs in simulation."
        actions={
          <Badge tone={nebius.tone} dot title={nebius.detail}>
            AI explanations: {nebius.label}
          </Badge>
        }
      />

      <DemoRunbook />

      <section aria-label="Key performance indicators">
        {state.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Loading KPIs">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
        ) : state.isError ? (
          <Card>
            <ErrorState error={state.error} onRetry={() => void state.refetch()} title="Factory state unavailable" />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((k, i) => (
              <KpiCard key={k.key} label={k.label} value={k.value} hint={k.hint} derived={k.derived} tone={k.tone ?? KPI_TONES[i % KPI_TONES.length]} icon={KPI_ICONS[i % KPI_ICONS.length]} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-3">
        <RecentEventsCard />
        <PendingApprovalsCard />
        <RecentAuditCard />
      </div>

      <Card>
        <CardHeader title="Resource availability" description="Capacity available for dispatch right now" />
        <CardBody>
          {state.isLoading ? (
            <LoadingRows rows={3} />
          ) : data ? (
            <div className="grid gap-5 md:grid-cols-3">
              <Bar label="Workers available" value={data.workers.filter((w) => w.available !== false).length} total={data.workers.length} tone="bg-teal" />
              <Bar label="Robots available" value={data.robots.filter((r) => r.available !== false).length} total={data.robots.length} tone="bg-violet" />
              <Bar
                label="Machines healthy"
                value={data.machines.filter((m) => !/(fail|fault|warn|risk|degrad|down)/i.test(String(m.status ?? ""))).length}
                total={data.machines.length}
                tone="bg-green"
              />
            </div>
          ) : (
            <p className="text-sm text-muted">Resource data will appear once the backend is reachable.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
