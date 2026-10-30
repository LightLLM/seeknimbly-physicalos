"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Hexagon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useProposals } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, isActive } from "./nav";

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  className?: string;
  mobile?: boolean;
}

export function Sidebar({ collapsed, onToggle, onNavigate, className, mobile }: SidebarProps) {
  const pathname = usePathname();
  const proposals = useProposals();
  const pending = proposals.data?.filter((p) => p.status.toLowerCase() === "pending").length ?? 0;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 248 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("flex h-full shrink-0 flex-col bg-sidebar text-sidebar-fg", className)}
      aria-label="Primary"
    >
      <div className="flex h-16 items-center gap-2.5 px-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue text-white shadow-md shadow-blue/30">
          <Hexagon className="h-5 w-5" />
        </span>
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">Seeknimbly</p>
            <p className="truncate text-sm font-semibold tracking-tight">PhysicalOS</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {!collapsed ? (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/80">{group.title}</p>
            ) : (
              <div className="mx-2 mb-1 border-t border-white/10" />
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                const showBadge = item.href === "/approvals" && pending > 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? item.label : undefined}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                        active ? "bg-sidebar-active font-medium text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? <span className="absolute inset-y-2 left-0 w-1 rounded-full bg-blue" aria-hidden /> : null}
                      <Icon className={cn("h-4 w-4 shrink-0", active && "text-blue")} aria-hidden />
                      {!collapsed ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                      {showBadge ? (
                        <span
                          className={cn(
                            "mono rounded-full bg-red px-1.5 text-[10px] font-semibold text-white",
                            collapsed ? "absolute right-1 top-1" : "ml-auto",
                          )}
                        >
                          {pending}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!mobile && onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-12 items-center gap-2 border-t border-white/10 px-5 text-xs text-sidebar-muted hover:text-white"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed ? "Collapse" : null}
        </button>
      ) : null}
    </motion.aside>
  );
}
