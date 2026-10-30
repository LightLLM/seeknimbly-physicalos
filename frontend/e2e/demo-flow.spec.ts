import { expect, test } from "@playwright/test";

const API = process.env.PLAYWRIGHT_API_BASE_URL || "http://127.0.0.1:8000";

test.describe.configure({ mode: "serial" });

test.describe("PhysicalOS primary demo", () => {
  test.beforeEach(async ({ request }) => {
    const reset = await request.post(`${API}/api/demo/reset`, { data: {} });
    expect(reset.ok()).toBeTruthy();
  });

  test("command center → replay → recommend → approve → simulate → audit", async ({ page, request }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));

    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Factory Operations" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Simulation Mode").first()).toBeVisible();
    await expect(page.locator('[aria-label="Operational data flow"]')).toBeVisible();
    await expect(page.getByRole("combobox", { name: /Work order/i })).toBeEnabled({ timeout: 60_000 });

    const runbook = page.getByRole("region", { name: "Demo runbook" });

    await runbook.getByRole("button", { name: /Replay first failure/i }).click();
    await expect(page.getByText(/Replayed UDI/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/fault|M-CNC-01|UDI 51/i).first()).toBeVisible({ timeout: 60_000 });

    await runbook.getByRole("button", { name: /Request recommendation/i }).click();
    await expect(page.getByText(/Worker 1 \+ robot R1|Worker 1|Worker\s+1/i).first()).toBeVisible({ timeout: 60_000 });

    await runbook.getByRole("button", { name: /Create proposal/i }).click();
    await expect(page.getByText(/Proposal \d+ created/i)).toBeVisible({ timeout: 60_000 });

    await runbook.getByRole("button", { name: /^Approve$/i }).click();
    await expect(page.getByText(/Proposal approved|approved/i).first()).toBeVisible({ timeout: 60_000 });

    await runbook.getByRole("button", { name: /Simulate dispatch/i }).click();
    await expect(page.getByText(/Execution recorded|Flow complete|Dispatch simulated/i).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.goto("/audit", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Audit Trail" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("combobox", { name: /Filter by action/i })).toContainText("simulated_dispatch", {
      timeout: 60_000,
    });
    await expect(page.getByRole("row").filter({ hasText: "simulated_dispatch" }).first()).toBeVisible({
      timeout: 60_000,
    });

    expect(pageErrors, `page errors: ${pageErrors.join(" | ")}`).toEqual([]);

    const rec = await request.get(`${API}/api/recommend/O2`);
    const payload = await rec.json();
    payload.worker_id = 8;
    const bad = await request.post(`${API}/api/proposals`, { data: payload });
    expect(bad.status()).toBe(400);
  });
});
