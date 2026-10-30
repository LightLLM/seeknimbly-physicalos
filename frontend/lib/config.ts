/**
 * Public, non-secret runtime configuration.
 * NEVER put tokens or API keys in NEXT_PUBLIC_ variables — the demo admin token is
 * entered by the operator in Settings and kept in localStorage only.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export const APP_ENV: string =
  process.env.NEXT_PUBLIC_APP_ENV || (process.env.NODE_ENV === "production" ? "production" : "development");

export const DEMO_TOKEN_STORAGE_KEY = "seeknimbly.demoAdminToken";
export const SIDEBAR_STORAGE_KEY = "seeknimbly.sidebarCollapsed";
export const FACILITY_STORAGE_KEY = "seeknimbly.facility";

export const FACILITIES = [
  { id: "demo-plant-a", label: "Demo Plant · Line A" },
  { id: "demo-plant-b", label: "Demo Plant · Line B (stub)" },
] as const;
