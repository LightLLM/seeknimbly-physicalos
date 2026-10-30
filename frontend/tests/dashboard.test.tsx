import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { CommandCenter } from "@/components/demo/command-center";
import { STATE, mockApi, renderWithProviders } from "./utils";

describe("Factory Operations dashboard", () => {
  it("renders KPI cards, data-flow strip and the demo runbook from /api/state", async () => {
    mockApi({
      "/api/state": STATE,
      "/api/health": { status: "ok", ai_configured: false },
      "/api/events": [],
      "/api/proposals": [],
      "/api/audit": [],
      "/api/workflows": [],
      "/api/executions": [],
    });
    renderWithProviders(<CommandCenter />);

    expect(screen.getByText("Seeknimbly PhysicalOS")).toBeInTheDocument();
    expect(screen.getByLabelText("Demo runbook")).toBeInTheDocument();
    expect(screen.getByLabelText("Operational data flow")).toBeInTheDocument();
    expect(screen.getByLabelText("Factory floor live view")).toBeInTheDocument();
    expect(screen.getByLabelText("AI recommendations")).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByTestId("kpi-card")).toHaveLength(2));
    expect(screen.getByText("Open Orders")).toBeInTheDocument();
    expect(screen.getByText("Robots online")).toBeInTheDocument();
  });

  it("derives Factory Operations KPIs from state when the backend sends none", async () => {
    mockApi({
      "/api/state": { ...STATE, kpis: undefined },
      "/api/health": { status: "ok" },
      "/api/events": [],
      "/api/proposals": [],
      "/api/audit": [],
    });
    renderWithProviders(<CommandCenter />);
    await waitFor(() => expect(screen.getAllByTestId("kpi-card")).toHaveLength(5));
    expect(screen.getAllByText("Active Work Orders").length).toBeGreaterThan(0);
    expect(screen.getByText("Available Workers")).toBeInTheDocument();
    expect(screen.getByText("Available Robots")).toBeInTheDocument();
    expect(screen.getByText("Production Progress")).toBeInTheDocument();
    expect(screen.getByText("Safety Status")).toBeInTheDocument();
    expect(screen.getAllByText("derived from state").length).toBeGreaterThan(0);
  });

  it("shows an actionable error state when the backend is unreachable", async () => {
    const { vi } = await import("vitest");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderWithProviders(<CommandCenter />);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Factory state unavailable")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /retry/i }).length).toBeGreaterThan(0);
  });
});

