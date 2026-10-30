import * as React from "react";
import { Badge } from "./badge";
import { cn, type Tone } from "@/lib/utils";

const iconTone: Record<Tone, string> = {
  neutral: "bg-elevated text-muted",
  teal: "bg-teal/10 text-teal",
  violet: "bg-violet/10 text-violet",
  amber: "bg-amber/10 text-amber",
  red: "bg-red/10 text-red",
  green: "bg-green/10 text-green",
  blue: "bg-blue/10 text-blue",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "blue",
  derived,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  derived?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm" data-testid="kpi-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon ? (
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", iconTone[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        {hint ? <span>{hint}</span> : null}
        {derived ? <Badge>derived from state</Badge> : null}
      </div>
    </div>
  );
}
