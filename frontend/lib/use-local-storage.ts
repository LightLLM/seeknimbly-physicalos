"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

export function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null || value === "") window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
  listeners.forEach((l) => l());
}

/** SSR-safe localStorage-backed string state (no setState-in-effect). */
export function useLocalStorage(key: string, fallback = ""): [string, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readStorage(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback((next: string | null) => writeStorage(key, next), [key]);
  return [value, set];
}
