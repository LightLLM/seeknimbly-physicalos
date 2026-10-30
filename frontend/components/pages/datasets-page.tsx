"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Download, Play } from "lucide-react";
import { toast } from "sonner";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input, Label } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, QueryBoundary } from "@/components/ui/states";
import { DemoRunbook } from "@/components/demo/runbook";
import { useDemoFlow } from "@/components/demo/demo-flow";
import { describeError } from "@/lib/api/client";
import { useDatasets, useEvents, useImportDataset } from "@/lib/api/hooks";
import type { Dataset } from "@/lib/api/schemas";
import { collectMeasurements, type Measurement } from "@/lib/normalize";
import { asText, formatTimestamp, formatNumber } from "@/lib/utils";

const MAX_POINTS = 800;

const udiSchema = z.object({
  udi: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a positive whole number")
    .refine((v) => Number(v) >= 1, "UDI starts at 1"),
});
type UdiForm = z.infer<typeof udiSchema>;

const tooltipStyle = {
  contentStyle: { background: "var(--elevated)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--fg)" },
  labelStyle: { color: "var(--muted)" },
  itemStyle: { color: "var(--fg)" },
};
const axisProps = { stroke: "var(--muted)", tick: { fontSize: 11, fill: "var(--muted)" } };

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody>
        <div className="h-[280px]">{children}</div>
      </CardBody>
    </Card>
  );
}

function Charts({ data }: { data: Measurement[] }) {
  const sample = data.length > MAX_POINTS ? data.filter((_, i) => i % Math.ceil(data.length / MAX_POINTS) === 0) : data;
  const normal = sample.filter((m) => !m.failure);
  const failures = sample.filter((m) => m.failure);
  const wearSeries = [...sample].filter((m) => m.toolWear !== undefined).sort((a, b) => a.udi - b.udi);

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <ChartCard title="Torque vs rotational speed" description="Failures cluster at extreme torque / low speed">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="rpm" name="Speed" unit=" rpm" domain={["auto", "auto"]} {...axisProps} />
            <YAxis type="number" dataKey="torque" name="Torque" unit=" Nm" domain={["auto", "auto"]} {...axisProps} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Scatter name="Normal" data={normal} fill="var(--blue)" fillOpacity={0.55} />
            <Scatter name="Failure" data={failures} fill="var(--red)" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tool wear by UDI" description="Cumulative wear in minutes">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wearSeries} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis dataKey="udi" {...axisProps} />
            <YAxis {...axisProps} />
            <Tooltip {...tooltipStyle} />
            <Line type="monotone" dataKey="toolWear" name="Tool wear (min)" stroke="var(--amber)" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Air vs process temperature" description="Heat dissipation failures follow a small temperature delta">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
            <XAxis type="number" dataKey="airTemp" name="Air" unit=" K" domain={["auto", "auto"]} {...axisProps} />
            <YAxis type="number" dataKey="processTemp" name="Process" unit=" K" domain={["auto", "auto"]} {...axisProps} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} {...tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Scatter name="Normal" data={normal} fill="var(--teal)" fillOpacity={0.5} />
            <Scatter name="Failure" data={failures} fill="var(--red)" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

const columns: ColumnDef<Dataset, unknown>[] = [
  { id: "name", header: "Dataset", accessorFn: (d) => d.name ?? String(d.id ?? "dataset"), cell: (c) => <span className="font-medium">{String(c.getValue())}</span> },
  { accessorKey: "source", header: "Source", cell: (c) => asText(c.row.original.source) },
  { accessorKey: "license", header: "License", cell: (c) => asText(c.row.original.license) },
  { id: "rows", header: "Rows", accessorFn: (d) => d.rows ?? d.row_count, cell: (c) => <Mono className="text-sm">{formatNumber(c.getValue())}</Mono> },
  { accessorKey: "status", header: "Status", cell: (c) => <StatusBadge status={c.row.original.status ?? "unknown"} /> },
  { accessorKey: "imported_at", header: "Imported", cell: (c) => <Mono className="text-muted">{formatTimestamp(c.row.original.imported_at)}</Mono> },
];

export function DatasetsPage() {
  const datasets = useDatasets();
  const events = useEvents();
  const importer = useImportDataset();
  const flow = useDemoFlow();
  const form = useForm<UdiForm>({ resolver: zodResolver(udiSchema), defaultValues: { udi: "" } });

  const measurements = React.useMemo(() => collectMeasurements(datasets.data, events.data), [datasets.data, events.data]);
  const failures = measurements.filter((m) => m.failure);

  const doImport = () =>
    importer.mutate(undefined, {
      onSuccess: () => toast.success("Dataset import requested", { description: "AI4I 2020 Predictive Maintenance dataset." }),
      onError: (e) => toast.error("Import failed", { description: describeError(e) }),
    });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Datasets"
        description="Public industrial telemetry (AI4I 2020 Predictive Maintenance) used to drive replayable machine-failure events."
        actions={
          <Button loading={importer.isPending} onClick={doImport}>
            <Download className="h-4 w-4" /> Import AI4I dataset
          </Button>
        }
      />
      <DemoRunbook compact />

      <Card>
        <CardHeader title="Registered datasets" description="Provenance and import status as reported by the backend" />
        <QueryBoundary query={datasets} rows={3}>
          <DataTable
            data={datasets.data ?? []}
            columns={columns}
            pageSize={8}
            emptyTitle="No datasets imported"
            emptyDescription="Import the AI4I dataset to enable measurement charts and UDI-based event replay."
            emptyAction={
              <Button size="sm" variant="primary" loading={importer.isPending} onClick={doImport}>
                <Download className="h-3.5 w-3.5" /> Import AI4I dataset
              </Button>
            }
          />
        </QueryBoundary>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Measurements loaded" value={formatNumber(measurements.length)} tone="blue" hint="rows exposed by the API" />
        <KpiCard label="Failure rows" value={formatNumber(failures.length)} tone={failures.length ? "red" : "teal"} />
        <KpiCard label="Failure rate" value={measurements.length ? `${((failures.length / measurements.length) * 100).toFixed(1)}%` : "—"} tone="amber" />
      </div>

      {measurements.length > 0 ? (
        <Charts data={measurements} />
      ) : (
        <Card>
          <EmptyState
            title="No AI4I measurements available"
            description="Charts render when /api/datasets (measurements or sample rows) or /api/events payloads include AI4I columns such as torque, rotational speed, tool wear and temperatures. Nothing is fabricated client-side."
          />
        </Card>
      )}

      <Card>
        <CardHeader title="Replay a specific record" description="Inject an AI4I row as a machine event by its UDI" />
        <CardBody className="space-y-4">
          <form
            className="flex flex-wrap items-start gap-3"
            onSubmit={form.handleSubmit((values) => {
              const udi = Number(values.udi);
              flow.setUdi(udi);
              flow.replay(udi);
            })}
            noValidate
          >
            <div className="w-48">
              <Label htmlFor="replay-udi">UDI</Label>
              <Input id="replay-udi" inputMode="numeric" placeholder="e.g. 69" aria-invalid={!!form.formState.errors.udi} {...form.register("udi")} />
              {form.formState.errors.udi ? <p className="mt-1 text-xs text-red">{form.formState.errors.udi.message}</p> : null}
            </div>
            <Button type="submit" variant="primary" className="mt-5" loading={flow.busy.replay}>
              <Play className="h-4 w-4" /> Replay UDI
            </Button>
          </form>
          {failures.length ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted">Failure records in loaded data</p>
              <div className="flex flex-wrap gap-1.5">
                {failures.slice(0, 16).map((m) => (
                  <button key={m.udi} type="button" onClick={() => form.setValue("udi", String(m.udi), { shouldValidate: true })}>
                    <Badge tone="red" className="mono cursor-pointer hover:bg-red/25">
                      UDI {m.udi}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
