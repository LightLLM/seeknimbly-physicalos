"use client";

import * as React from "react";
import { Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { Bot, Cog, User } from "lucide-react";
import type { Machine, Proposal, Robot, Worker } from "@/lib/api/schemas";
import { cn, statusTone, type Tone } from "@/lib/utils";

export type EntityKind = "machine" | "worker" | "robot";
export type EntityData = {
  kind: EntityKind;
  title: string;
  subtitle: string;
  status: string;
  raw: unknown;
};
type EntityNode = Node<EntityData, "entity">;

const toneBorder: Record<Tone, string> = {
  neutral: "border-line",
  teal: "border-teal/60",
  violet: "border-violet/60",
  amber: "border-amber/60",
  red: "border-red/70",
  green: "border-green/50",
  blue: "border-blue/60",
};
const toneDot: Record<Tone, string> = {
  neutral: "bg-muted",
  teal: "bg-teal",
  violet: "bg-violet",
  amber: "bg-amber",
  red: "bg-red",
  green: "bg-green",
  blue: "bg-blue",
};
const kindIcon = { machine: Cog, worker: User, robot: Bot } as const;
const kindAccent = { machine: "text-blue", worker: "text-teal", robot: "text-violet" } as const;

function EntityNodeView({ data, selected }: NodeProps<EntityNode>) {
  const Icon = kindIcon[data.kind];
  const tone = statusTone(data.status);
  return (
    <div className={cn("w-[190px] rounded-md border bg-surface px-3 py-2 shadow-sm", toneBorder[tone], selected && "ring-2 ring-teal")}>
      {data.kind !== "machine" ? <Handle type="target" position={Position.Left} /> : null}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", kindAccent[data.kind])} aria-hidden />
        <span className="truncate text-xs font-semibold">{data.title}</span>
        <span className={cn("ml-auto h-2 w-2 shrink-0 rounded-full", toneDot[tone])} title={data.status} />
      </div>
      <p className="mono mt-1 truncate text-[10px] text-muted">{data.subtitle}</p>
      {data.kind !== "robot" ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}

const nodeTypes = { entity: EntityNodeView };

const COLUMN_X = { machine: 0, worker: 330, robot: 660 } as const;
const ROW_H = 84;

export interface FactoryFlowProps {
  machines: Machine[];
  workers: Worker[];
  robots: Robot[];
  proposals: Proposal[];
  onSelect?: (data: EntityData | null) => void;
}

export function buildFactoryGraph({ machines, workers, robots, proposals }: Omit<FactoryFlowProps, "onSelect">) {
  const nodes: EntityNode[] = [];
  machines.forEach((m, i) =>
    nodes.push({
      id: `m-${m.id}`,
      type: "entity",
      position: { x: COLUMN_X.machine, y: i * ROW_H },
      data: { kind: "machine", title: m.name ?? `Machine ${m.id}`, subtitle: `${m.type ?? "machine"} · #${m.id}`, status: String(m.status ?? "unknown"), raw: m },
    }),
  );
  workers.forEach((w, i) =>
    nodes.push({
      id: `w-${w.id}`,
      type: "entity",
      position: { x: COLUMN_X.worker, y: i * ROW_H },
      data: { kind: "worker", title: w.name ?? `Worker ${w.id}`, subtitle: w.skills.join(", ") || "no skills", status: w.available === false ? "unavailable" : "available", raw: w },
    }),
  );
  robots.forEach((r, i) =>
    nodes.push({
      id: `r-${r.id}`,
      type: "entity",
      position: { x: COLUMN_X.robot, y: i * ROW_H },
      data: { kind: "robot", title: `Robot ${r.id}`, subtitle: `${r.type ?? "robot"}`, status: String(r.status ?? (r.available === false ? "unavailable" : "available")), raw: r },
    }),
  );

  const ids = new Set(nodes.map((n) => n.id));
  const edges: Edge[] = [];
  for (const p of proposals) {
    const status = p.status.toLowerCase();
    if (status === "rejected") continue;
    const animated = status === "pending";
    const style = { stroke: animated ? "var(--amber)" : "var(--green)", strokeWidth: 2, strokeDasharray: animated ? "6 4" : undefined };
    const w = `w-${p.worker_id}`;
    const r = `r-${p.robot_id}`;
    const m = p.machine_id !== undefined && p.machine_id !== null ? `m-${p.machine_id}` : null;
    if (m && ids.has(m) && ids.has(w)) edges.push({ id: `e-${p.id}-mw`, source: m, target: w, animated, style, label: `#${p.id}` });
    if (ids.has(w) && ids.has(r)) edges.push({ id: `e-${p.id}-wr`, source: w, target: r, animated, style, label: m ? undefined : `#${p.id}` });
  }
  return { nodes, edges };
}

export default function FactoryFlow({ machines, workers, robots, proposals, onSelect }: FactoryFlowProps) {
  const { resolvedTheme } = useTheme();
  const { nodes, edges } = React.useMemo(() => buildFactoryGraph({ machines, workers, robots, proposals }), [machines, workers, robots, proposals]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode={resolvedTheme === "light" ? "light" : "dark"}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      minZoom={0.3}
      onNodeClick={(_, node) => onSelect?.((node.data as EntityData) ?? null)}
      onPaneClick={() => onSelect?.(null)}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--line)" />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable nodeColor="var(--line)" maskColor="rgba(0,0,0,0.25)" className="hidden md:block" />
    </ReactFlow>
  );
}
