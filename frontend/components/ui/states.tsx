"use client";

import * as React from "react";
import { AlertTriangle, Inbox, RefreshCw, ServerOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";
import { ApiError } from "@/lib/api/client";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center" role="status">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-elevated text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-md text-xs leading-5 text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const network = error instanceof ApiError && error.network;
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const Icon = network ? ServerOff : AlertTriangle;
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center" role="alert">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-red/40 bg-red/10 text-red">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium">{title ?? (network ? "Backend unreachable" : "Request failed")}</p>
      <p className="max-w-md text-xs leading-5 text-muted">{message}</p>
      {network ? (
        <p className="max-w-md text-xs leading-5 text-muted">
          Start the FastAPI backend and confirm <code className="mono rounded bg-elevated px-1">{API_BASE_URL}</code> is reachable
          (set <code className="mono rounded bg-elevated px-1">NEXT_PUBLIC_API_BASE_URL</code> to change it).
        </p>
      ) : null}
      {onRetry ? (
        <Button size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingRows({ rows = 5, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-2 p-4" role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Standard loading → error → content gate for a query. */
export function QueryBoundary({ query, rows, children }: { query: QueryLike; rows?: number; children: React.ReactNode }) {
  if (query.isLoading) return <LoadingRows rows={rows} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children}</>;
}
