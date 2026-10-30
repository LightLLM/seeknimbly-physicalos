"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ChevronRight, MapPin, Menu, Moon, Search, ShieldAlert, Sun, UserCircle2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useFactoryState, useHealth } from "@/lib/api/hooks";
import { APP_ENV, FACILITIES, FACILITY_STORAGE_KEY } from "@/lib/config";
import { resolveNebius } from "@/lib/normalize";
import { useLocalStorage } from "@/lib/use-local-storage";
import { ALL_NAV } from "./nav";
import { useSearch } from "./search-context";

function Breadcrumbs() {
  const pathname = usePathname();
  const current = ALL_NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link href="/" className="text-muted hover:text-fg">
        PhysicalOS
      </Link>
      <ChevronRight className="h-3.5 w-3.5 text-muted/70" aria-hidden />
      <span className="font-medium" aria-current="page">
        {current?.label ?? "Console"}
      </span>
    </nav>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}>
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </Button>
  );
}

function FacilitySelect() {
  const [facility, setFacility] = useLocalStorage(FACILITY_STORAGE_KEY, FACILITIES[0].id);
  return (
    <label className="relative hidden items-center md:flex">
      <MapPin className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
      <span className="sr-only">Facility</span>
      <select
        value={facility}
        onChange={(e) => setFacility(e.target.value)}
        className="h-8 rounded-md border border-line bg-elevated pl-8 pr-6 text-xs focus:border-teal"
      >
        {FACILITIES.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SearchBox() {
  const { query, setQuery } = useSearch();
  return (
    <div className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter tables on this page…"
        aria-label="Filter tables"
        className="h-8 w-full rounded-md border border-line bg-elevated pl-8 pr-8 text-xs placeholder:text-muted/70 focus:border-teal"
      />
      {query ? (
        <button type="button" onClick={() => setQuery("")} aria-label="Clear filter" className="absolute right-2 top-2 text-muted hover:text-fg">
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function StatusCluster() {
  const health = useHealth();
  const state = useFactoryState();
  const down = health.isError && health.error instanceof ApiError && health.error.network;
  const nebius = resolveNebius(health.data, state.data, down);

  return (
    <div className="flex items-center gap-2">
      <Badge tone="neutral" className="hidden sm:inline-flex" title="Deployment environment">
        env: <span className="mono">{APP_ENV}</span>
      </Badge>
      <Badge tone="amber" dot title="All dispatch is simulated; no physical robot is commanded.">
        <span className="hidden sm:inline">Simulation Mode</span>
        <span className="sm:hidden">Sim</span>
      </Badge>
      {down ? (
        <Badge tone="red" dot title="Cannot reach the FastAPI backend">
          <ShieldAlert className="h-3 w-3" /> API offline
        </Badge>
      ) : null}
      <Badge tone={nebius.tone} dot title={nebius.detail} data-testid="nebius-badge">
        Nebius · {nebius.label}
      </Badge>
    </div>
  );
}

export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-app/85 px-4 py-2 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onOpenMobileNav}>
        <Menu className="h-5 w-5" />
      </Button>
      <Breadcrumbs />
      <div className="order-last flex w-full justify-center md:order-none md:w-auto md:flex-1">
        <SearchBox />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <FacilitySelect />
        <StatusCluster />
        <ThemeToggle />
        <div className="hidden items-center gap-2 border-l border-line pl-3 lg:flex">
          <UserCircle2 className="h-6 w-6 text-muted" aria-hidden />
          <div className="leading-tight">
            <p className="text-xs font-medium">Demo Supervisor</p>
            <p className="text-[10px] text-muted">Supervisor role</p>
          </div>
        </div>
      </div>
    </header>
  );
}
