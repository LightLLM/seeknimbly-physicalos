import * as React from "react";
import { render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { vi } from "vitest";
import { DataProviders } from "@/components/providers";

export const STATE = {
  workers: [
    { id: 1, name: "Amina", skills: ["CNC", "inspection"], available: true },
    { id: 3, name: "Priya", skills: ["assembly"], available: false },
  ],
  orders: [{ id: "O1", task: "CNC housing", skill: "CNC", robot_type: "material" }],
  robots: [{ id: "R1", type: "material", available: true }],
  machines: [{ id: "M1", name: "Lathe 1", status: "failure" }],
  kpis: { open_orders: 4, robots_online: { label: "Robots online", value: 3 } },
  events: [{ id: 1, type: "machine_failure", message: "Tool wear failure on Lathe 1", machine_id: "M1", udi: 69, severity: "critical" }],
  nebius_status: "not_configured",
};

type Route = unknown | ((init?: RequestInit) => unknown | Response);

/** Stub global fetch with path-keyed JSON routes. Unknown routes answer 404 like FastAPI. */
export function mockApi(routes: Record<string, Route>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${pathname}`;
    const handler = routes[key] ?? routes[pathname];
    if (handler === undefined) {
      return new Response(JSON.stringify({ detail: "Not Found" }), { status: 404 });
    }
    const body = typeof handler === "function" ? (handler as (i?: RequestInit) => unknown)(init) : handler;
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function renderWithProviders(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<DataProviders client={client}>{ui}</DataProviders>);
}
