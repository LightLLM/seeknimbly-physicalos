import type { ZodType } from "zod";
import { API_BASE_URL, DEMO_TOKEN_STORAGE_KEY } from "@/lib/config";
import { readStorage } from "@/lib/use-local-storage";

export class ApiError extends Error {
  status: number;
  detail: unknown;
  network: boolean;

  constructor(message: string, status: number, detail?: unknown, network = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.network = network;
  }
}

function formatDetail(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => (item && typeof item === "object" && "msg" in item ? String((item as { msg: unknown }).msg) : null))
      .filter(Boolean);
    if (parts.length) return parts.join("; ");
  }
  return fallback;
}

interface RequestOptions<T> {
  method?: "GET" | "POST";
  body?: unknown;
  schema?: ZodType<T>;
  signal?: AbortSignal;
}

export function getDemoToken(): string {
  return readStorage(DEMO_TOKEN_STORAGE_KEY) ?? "";
}

export async function request<T = unknown>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = "GET", body, schema, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const token = getDemoToken();
    if (token) headers["X-Demo-Admin-Token"] = token;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(`Backend unreachable at ${API_BASE_URL}`, 0, cause, true);
  }

  const raw = await response.text();
  let payload: unknown = undefined;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? (payload as { detail: unknown }).detail : payload;
    throw new ApiError(formatDetail(detail, `Request failed (${response.status})`), response.status, detail);
  }

  if (!schema) return payload as T;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(`Unexpected response shape from ${path}`, response.status, parsed.error.issues);
  }
  return parsed.data;
}

/** Human readable message including auth hints for mutating calls. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return `${error.message}. Set the Demo Admin Token in Settings.`;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Unknown error";
}
