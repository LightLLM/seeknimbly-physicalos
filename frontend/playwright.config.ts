import { defineConfig, devices } from "@playwright/test";

const reuse = !process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: ".venv\\Scripts\\python.exe -m uvicorn api.index:app --host 127.0.0.1 --port 8000",
      cwd: "..",
      url: "http://127.0.0.1:8000/api/health",
      timeout: 60_000,
      reuseExistingServer: reuse,
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000",
      timeout: 120_000,
      reuseExistingServer: reuse,
      env: { NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:8000" },
    },
  ],
});
