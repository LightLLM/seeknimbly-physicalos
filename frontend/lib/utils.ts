import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Tone = "neutral" | "teal" | "violet" | "amber" | "red" | "green" | "blue";

/** Map an arbitrary backend status string to a visual tone. Failure words win first. */
export function statusTone(status: unknown): Tone {
  const s = String(status ?? "").toLowerCase();
  if (!s) return "neutral";
  if (/(fail|error|reject|down|critical|fault|unavailable|offline|blocked|denied|stopped)/.test(s)) return "red";
  if (/(pending|warn|degrad|queue|running|progress|waiting|maint|unverified|configured|at.?risk|active)/.test(s)) return "amber";
  if (/(simulat|info|created|replay)/.test(s)) return "blue";
  if (/(ok|healthy|available|approv|complete|success|done|verified|online|idle|ready|nominal)/.test(s)) return "green";
  return "neutral";
}

export function titleCase(input: string): string {
  return input
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Deterministic absolute timestamp (UTC) — avoids hydration drift and impure Date.now() in render. */
export function formatTimestamp(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : (value as string | number));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

export function formatNumber(value: unknown, digits = 1): string {
  if (typeof value !== "number" || Number.isNaN(value)) return value === null || value === undefined ? "—" : String(value);
  return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Return the first defined, non-null value among candidate keys on a loose record. */
export function pick<T = unknown>(obj: unknown, ...keys: string[]): T | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return undefined;
}

export function asText(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/** Try to JSON.parse a string field (SQLite audit `detail` is stored as JSON text). */
export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[{[]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
