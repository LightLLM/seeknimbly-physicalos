"use client";

import Link from "next/link";
import { AlertTriangle, Radio, ScrollText } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Mono } from "@/components/ui/mono";
import { EmptyState, QueryBoundary } from "@/components/ui/states";
import { useAudit, useEvents, useProposals } from "@/lib/api/hooks";
import type { AuditEntry, FactoryEvent } from "@/lib/api/schemas";
import { eventKey, eventTime, eventTitle } from "@/lib/normalize";
import { asText, formatTimestamp, parseMaybeJson, statusTone } from "@/lib/utils";
import { ProposalActions } from "./proposal-actions";

export function EventRow({ event, selected, onClick }: { event: FactoryEvent; selected?: boolean; onClick?: () => void }) {
  const severity = event.severity ?? undefined;
  const className = `flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left ${selected ? "border-teal/60 bg-teal/5" : "border-line bg-elevated/40"} ${onClick ? "hover:bg-elevated" : ""}`;
  const body = (
    <>
      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${statusTone(severity ?? "warning") === "red" ? "text-red" : "text-amber"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{eventTitle(event)}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
          <Mono>{formatTimestamp(eventTime(event))}</Mono>
          {event.machine_id !== undefined && event.machine_id !== null ? <Mono>machine {String(event.machine_id)}</Mono> : null}
          {event.udi !== undefined && event.udi !== null ? <Mono>UDI {event.udi}</Mono> : null}
        </p>
      </div>
      {severity ? <StatusBadge status={severity} /> : null}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={className} aria-pressed={selected}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function RecentEventsCard({ limit = 6 }: { limit?: number }) {
  const events = useEvents();
  const list = events.data ?? [];
  return (
    <Card>
      <CardHeader title="Machine events" description="Latest signals from the factory floor" action={<Radio className="h-4 w-4 text-muted" />} />
      <QueryBoundary query={events} rows={3}>
        {list.length === 0 ? (
          <EmptyState title="No events yet" description="Replay a failure event from the runbook to inject a machine fault." />
        ) : (
          <ul className="space-y-2 p-3">
            {list.slice(0, limit).map((e, i) => (
              <li key={eventKey(e, i)}>
                <EventRow event={e} />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
}

export function PendingApprovalsCard() {
  const proposals = useProposals();
  const pending = (proposals.data ?? []).filter((p) => p.status.toLowerCase() === "pending");
  return (
    <Card>
      <CardHeader
        title="Pending approvals"
        description="Human-in-the-loop decisions"
        action={<Link href="/approvals" className="text-xs text-teal hover:underline">View all</Link>}
      />
      <QueryBoundary query={proposals} rows={3}>
        {pending.length === 0 ? (
          <EmptyState title="Nothing awaiting approval" description="Create a proposal from a recommendation to request supervisor sign-off." />
        ) : (
          <ul className="divide-y divide-line/60">
            {pending.slice(0, 4).map((p) => (
              <li key={String(p.id)} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <Mono className="text-sm">#{String(p.id)}</Mono> · Order <Mono className="text-sm">{String(p.order_id)}</Mono>
                  </p>
                  <p className="text-xs text-muted">
                    Worker {String(p.worker_id)} + robot {String(p.robot_id)}
                  </p>
                </div>
                <ProposalActions proposal={p} />
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
}

export function AuditPreview({ entry }: { entry: AuditEntry }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <Badge tone={statusTone(entry.action)}>{entry.action}</Badge>
      <div className="min-w-0 flex-1">
        <p className="mono truncate text-[11px] text-muted">{asText(parseMaybeJson(entry.detail), "")}</p>
      </div>
      <Mono className="shrink-0 text-muted">{formatTimestamp(entry.created_at)}</Mono>
    </li>
  );
}

export function RecentAuditCard({ limit = 5 }: { limit?: number }) {
  const audit = useAudit();
  const list = audit.data ?? [];
  return (
    <Card>
      <CardHeader
        title="Recent audit activity"
        description="Immutable decision log"
        action={<Link href="/audit" className="inline-flex items-center gap-1 text-xs text-teal hover:underline"><ScrollText className="h-3.5 w-3.5" /> Open trail</Link>}
      />
      <QueryBoundary query={audit} rows={3}>
        {list.length === 0 ? (
          <EmptyState title="No audit entries" description="Proposal creation, decisions and simulations are recorded here." />
        ) : (
          <ul className="divide-y divide-line/60">
            {list.slice(0, limit).map((a) => (
              <AuditPreview key={String(a.id)} entry={a} />
            ))}
          </ul>
        )}
      </QueryBoundary>
    </Card>
  );
}
