import * as React from "react";
import { cn } from "@/lib/utils";

/** Geist Mono for identifiers and timestamps. */
export function Mono({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("mono text-xs", className)} {...props} />;
}

export function Json({ value }: { value: unknown }) {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return (
    <pre className="mono max-h-64 overflow-auto rounded-md border border-line bg-elevated p-3 text-[11px] leading-5 text-muted">{text}</pre>
  );
}
