"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = React.createContext<SearchContextValue>({ query: "", setQuery: () => {} });

/** Header search is a local filter stub: tables read `query` and filter client-side. */
export function SearchProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");
  // Clear the filter on navigation (derived state update during render of the owning component).
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setQuery("");
  }
  const value = React.useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export const useSearch = () => React.useContext(SearchContext);

/** Case-insensitive match of any value in a record against the query. */
export function matchesQuery(row: unknown, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  try {
    return JSON.stringify(row).toLowerCase().includes(q);
  } catch {
    return true;
  }
}
