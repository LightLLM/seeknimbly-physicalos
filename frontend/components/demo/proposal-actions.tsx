"use client";

import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { describeError } from "@/lib/api/client";
import { useDecision } from "@/lib/api/hooks";
import type { Proposal } from "@/lib/api/schemas";

/** Approve / reject a pending proposal with optimistic-free, server-confirmed feedback. */
export function ProposalActions({ proposal, size = "sm" }: { proposal: Proposal; size?: "sm" | "md" }) {
  const decision = useDecision();
  const pending = proposal.status.toLowerCase() === "pending";

  const decide = (approve: boolean) =>
    decision.mutate(
      { id: proposal.id, approve },
      {
        onSuccess: () => toast.success(`Proposal ${proposal.id} ${approve ? "approved" : "rejected"}`),
        onError: (e) => toast.error("Decision failed", { description: describeError(e) }),
      },
    );

  if (!pending) return <span className="text-xs text-muted">Decided</span>;
  return (
    <div className="flex gap-1.5">
      <Button size={size} variant="success" loading={decision.isPending && decision.variables?.approve === true} disabled={decision.isPending} onClick={() => decide(true)} aria-label={`Approve proposal ${proposal.id}`}>
        <Check className="h-3.5 w-3.5" /> Approve
      </Button>
      <Button size={size} variant="danger" loading={decision.isPending && decision.variables?.approve === false} disabled={decision.isPending} onClick={() => decide(false)} aria-label={`Reject proposal ${proposal.id}`}>
        <X className="h-3.5 w-3.5" /> Reject
      </Button>
    </div>
  );
}
