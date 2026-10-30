import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, statusTone, type Tone } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4", {
  variants: {
    tone: {
      neutral: "border-line bg-elevated text-muted",
      teal: "border-teal/40 bg-teal/12 text-teal",
      violet: "border-violet/40 bg-violet/12 text-violet",
      amber: "border-amber/40 bg-amber/12 text-amber",
      red: "border-red/40 bg-red/12 text-red",
      green: "border-green/40 bg-green/12 text-green",
      blue: "border-blue/40 bg-blue/12 text-blue",
    },
  },
  defaultVariants: { tone: "neutral" },
});

const dotColor: Record<Tone, string> = {
  neutral: "bg-muted",
  teal: "bg-teal",
  violet: "bg-violet",
  amber: "bg-amber",
  red: "bg-red",
  green: "bg-green",
  blue: "bg-blue",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[tone ?? "neutral"])} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Badge whose tone is derived from a backend status string. */
export function StatusBadge({ status, label }: { status: unknown; label?: string }) {
  const text = label ?? (status === null || status === undefined || status === "" ? "unknown" : String(status));
  return (
    <Badge tone={statusTone(status)} dot>
      {text}
    </Badge>
  );
}
