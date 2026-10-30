"use client";

import * as React from "react";
import { Background, BackgroundVariant, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { Check, CircleDashed, Loader2, X } from "lucide-react";
import { cn, statusTone, type Tone } from "@/lib/utils";

export interface StageNodeInput {
  id: string;
  label: string;
  /** done | active | todo | error, or any backend status string */
  status: string;
  detail?: string;
}

type StageData = { label: string; status: string; detail?: string; index: number };
type StageNode = Node<StageData, "stage">;

const border: Record<Tone, string> = {
  neutral: "border-line",
  teal: "border-teal",
  violet: "border-violet",
  amber: "border-amber",
  red: "border-red",
  green: "border-green/60",
  blue: "border-blue",
};

function toneFor(status: string): Tone {
  const s = status.toLowerCase();
  if (s === "done") return "green";
  if (s === "active") return "teal";
  if (s === "error") return "red";
  if (s === "todo") return "neutral";
  return statusTone(status);
}

function StageNodeView({ data }: NodeProps<StageNode>) {
  const tone = toneFor(data.status);
  const s = data.status.toLowerCase();
  const Icon = tone === "green" ? Check : tone === "red" ? X : s === "active" || tone === "amber" ? Loader2 : CircleDashed;
  return (
    <div className={cn("w-[220px] rounded-md border bg-surface px-3 py-2.5", border[tone], s === "active" && "pulse-ring")} data-testid={`stage-${data.index}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-2">
        <span className="mono flex h-5 w-5 items-center justify-center rounded-full bg-elevated text-[10px] text-muted">{data.index + 1}</span>
        <span className="truncate text-xs font-semibold">{data.label}</span>
        <Icon className={cn("ml-auto h-3.5 w-3.5 shrink-0", tone === "green" && "text-green", tone === "red" && "text-red", tone === "teal" && "text-teal", tone === "amber" && "text-amber", tone === "neutral" && "text-muted")} aria-hidden />
      </div>
      <p className="mono mt-1 truncate text-[10px] text-muted">{data.detail ?? data.status}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { stage: StageNodeView };

export default function WorkflowFlow({ stages }: { stages: StageNodeInput[] }) {
  const { resolvedTheme } = useTheme();
  const { nodes, edges } = React.useMemo(() => {
    const nodes: StageNode[] = stages.map((s, i) => ({
      id: `stage-${s.id}`,
      type: "stage",
      position: { x: 0, y: i * 104 },
      data: { label: s.label, status: s.status, detail: s.detail, index: i },
    }));
    const edges: Edge[] = stages.slice(1).map((s, i) => {
      const prevDone = ["done", "completed", "approved"].includes(stages[i].status.toLowerCase());
      return {
        id: `edge-${i}`,
        source: `stage-${stages[i].id}`,
        target: `stage-${s.id}`,
        animated: stages[i].status.toLowerCase() === "active",
        style: { stroke: prevDone ? "var(--green)" : "var(--line)", strokeWidth: 2 },
      };
    });
    return { nodes, edges };
  }, [stages]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll={false}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--line)" />
    </ReactFlow>
  );
}
