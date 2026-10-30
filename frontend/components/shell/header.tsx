"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, MapPin, Menu, Moon, Search, ShieldAlert, Sun, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useFactoryState, useHealth, useProposals } from "@/lib/api/hooks";
import { APP_ENV, FACILITIES, FACILITY_STORAGE_KEY } from "@/lib/config";
import { resolveNebius } from "@/lib/normalize";
import { useLocalStorage } from "@/lib/use-local-storage";
import { ALL_NAV } from "./nav";
import { useSearch } from "./search-context";

function PageIntro() {
  const pathname = usePathname();
  const current = ALL_NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));
  const isHome = pathname === "/";
  return (
    <div className="min-w-0">
      <h1 className="truncate text-lg font-semibold tracking-tight md:text-xl">
        {isHome ? "Factory Operations" : (current?.label ?? "Console")}
      </h1>
      <p className="truncate text-xs text-muted">
        {isHome ? "Human + AI + Robots. A safer, smarter, more productive factory." : "Seeknimbly PhysicalOS · simulation mode"}
      </p>
    </div>
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
        className="h-9 rounded-xl border border-line bg-surface pl-8 pr-6 text-xs shadow-sm focus:border-blue"
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
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" aria-hidden />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search work orders, workers, robots…"
        aria-label="Filter tables"
        className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-8 text-xs shadow-sm placeholder:text-muted/70 focus:border-blue"
      />
      {query ? (
        <button type="button" onClick={() => setQuery("")} aria-label="Clear filter" className="absolute right-2 top-2.5 text-muted hover:text-fg">
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

function Notifications() {
  const proposals = useProposals();
  const pending = proposals.data?.filter((p) => p.status.toLowerCase() === "pending").length ?? 0;
  return (
    <Link
      href="/approvals"
      aria-label={pending ? `${pending} pending approvals` : "Notifications"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted shadow-sm hover:text-fg"
    >
      <Bell className="h-4 w-4" />
      {pending > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red" /> : null}
    </Link>
  );
}

export function Header({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={onOpenMobileNav}>
        <Menu className="h-5 w-5" />
      </Button>
      <PageIntro />
      <div className="order-last flex w-full justify-center md:order-none md:w-auto md:flex-1">
        <SearchBox />
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <FacilitySelect />
        <StatusCluster />
        <Notifications />
        <ThemeToggle />
        <div className="hidden items-center gap-2.5 border-l border-line pl-3 lg:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue/10 text-xs font-semibold text-blue">JS</span>
          <div className="leading-tight">
            <p className="text-xs font-semibold">Jessica Smith</p>
            <p className="text-[10px] text-muted">Operations Supervisor</p>
          </div>
        </div>
      </div>
    </header>
  );
}
