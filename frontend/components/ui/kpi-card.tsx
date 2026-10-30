import * as React from "react";
import { Badge } from "./badge";
import { cn, type Tone } from "@/lib/utils";

const accent: Record<Tone, string> = {
  neutral: "bg-muted",
  teal: "bg-teal",
  violet: "bg-violet",
  amber: "bg-amber",
  red: "bg-red",
  green: "bg-green",
  blue: "bg-blue",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "teal",
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
    <div className="relative overflow-hidden rounded-lg border border-line bg-surface p-4" data-testid="kpi-card">
      <span className={cn("absolute inset-y-0 left-0 w-0.5", accent[tone])} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-muted" /> : null}
      </div>
      <p className="mono mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        {hint ? <span>{hint}</span> : null}
        {derived ? <Badge>derived from state</Badge> : null}
      </div>
    </div>
  );
}
