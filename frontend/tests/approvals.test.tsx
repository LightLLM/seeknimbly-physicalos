import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalsPage } from "@/components/pages/approvals-page";
import { DEMO_TOKEN_STORAGE_KEY } from "@/lib/config";
import { STATE, mockApi, renderWithProviders } from "./utils";

const PROPOSAL = { id: 7, order_id: "O1", worker_id: 1, robot_id: "R1", source: "rules", rationale: "Qualified available assignment", status: "pending", created_at: "2026-10-30T00:00:00+00:00" };

describe("Approvals", () => {
  it("lists pending proposals and sends the demo admin token with the decision", async () => {
    window.localStorage.setItem(DEMO_TOKEN_STORAGE_KEY, "s3cret-token");
    const fetchMock = mockApi({
      "/api/state": STATE,
      "/api/health": { status: "ok" },
      "/api/proposals": [PROPOSAL],
      "/api/audit": [],
      "/api/workflows": [],
      "/api/executions": [],
      "POST /api/proposals/7/decision": { id: 7, status: "approved" },
    });
    renderWithProviders(<ApprovalsPage />);

    const approve = await screen.findByRole("button", { name: "Approve proposal 7" });
    await userEvent.click(approve);

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/proposals/7/decision") && init?.method === "POST");
      expect(call).toBeDefined();
      const headers = call![1]!.headers as Record<string, string>;
      expect(headers["X-Demo-Admin-Token"]).toBe("s3cret-token");
      expect(JSON.parse(String(call![1]!.body))).toEqual({ approve: true });
    });
  });

  it("shows an empty state when nothing is pending", async () => {
    mockApi({ "/api/state": STATE, "/api/health": { status: "ok" }, "/api/proposals": [], "/api/audit": [] });
    renderWithProviders(<ApprovalsPage />);
    expect(await screen.findByText("No pending approvals")).toBeInTheDocument();
  });
});
