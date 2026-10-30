import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "@/components/shell/header";
import { Sidebar } from "@/components/shell/sidebar";
import { STATE, mockApi, renderWithProviders } from "./utils";

describe("App shell", () => {
  it("renders header badges and never reports Nebius as verified without proof", async () => {
    mockApi({ "/api/health": { status: "ok", ai_configured: true, model: "m" }, "/api/state": { ...STATE, nebius_status: undefined }, "/api/proposals": [] });
    renderWithProviders(<Header onOpenMobileNav={() => {}} />);

    expect(screen.getByText("Jessica Smith")).toBeInTheDocument();
    expect(screen.getByText("Operations Supervisor")).toBeInTheDocument();
    expect(screen.getByText("Factory Operations")).toBeInTheDocument();
    expect(screen.getByText("Simulation Mode")).toBeInTheDocument();
    const badge = await screen.findByText(/Configured · not verified/);
    expect(badge).toBeInTheDocument();
    expect(screen.queryByText(/Nebius · Verified/)).not.toBeInTheDocument();
  });

  it("filters via the header search input", async () => {
    mockApi({ "/api/health": { status: "ok" }, "/api/state": STATE });
    renderWithProviders(<Header onOpenMobileNav={() => {}} />);
    const search = screen.getByLabelText("Filter tables");
    await userEvent.type(search, "lathe");
    expect(search).toHaveValue("lathe");
    await userEvent.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(search).toHaveValue("");
  });

  it("renders every dashboard route in the sidebar", async () => {
    mockApi({ "/api/proposals": [{ id: 1, order_id: "O1", worker_id: 1, robot_id: "R1", status: "pending" }] });
    renderWithProviders(<Sidebar collapsed={false} />);
    for (const label of [
      "Dashboard",
      "Factory Floor",
      "Work Orders",
      "Workforce",
      "Machines",
      "Robots & Machines",
      "AI Assistant",
      "Approvals",
      "Schedule",
      "Analytics",
      "Audit Log",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await waitFor(() => expect(screen.getByRole("link", { name: /Approvals/ })).toHaveTextContent("1"));
  });
});


