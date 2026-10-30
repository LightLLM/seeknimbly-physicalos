import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { CommandCenter } from "@/components/demo/command-center";
import { STATE, mockApi, renderWithProviders } from "./utils";

describe("Command Center", () => {
  it("renders KPI cards, events and the demo runbook from /api/state", async () => {
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

    expect(screen.getByRole("heading", { name: "Command Center" })).toBeInTheDocument();
    expect(screen.getByLabelText("Demo runbook")).toBeInTheDocument();

    await waitFor(() => expect(screen.getAllByTestId("kpi-card")).toHaveLength(2));
    expect(screen.getByText("Open Orders")).toBeInTheDocument();
    expect(screen.getByText("Robots online")).toBeInTheDocument();
    // dedicated /api/events returned [], so the empty state is shown rather than invented data
    expect(await screen.findByText("No events yet")).toBeInTheDocument();
  });

  it("derives KPIs from state and labels them when the backend sends none", async () => {
    mockApi({
      "/api/state": { ...STATE, kpis: undefined },
      "/api/health": { status: "ok" },
      "/api/events": [],
      "/api/proposals": [],
      "/api/audit": [],
    });
    renderWithProviders(<CommandCenter />);
    await waitFor(() => expect(screen.getAllByTestId("kpi-card")).toHaveLength(4));
    expect(screen.getAllByText("derived from state").length).toBeGreaterThan(0);
  });

  it("shows an actionable error state when the backend is unreachable", async () => {
    const { vi } = await import("vitest");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderWithProviders(<CommandCenter />);
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Backend unreachable")).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /retry/i }).length).toBeGreaterThan(0);
  });
});
