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
      animate={{ width: collapsed ? 68 : 248 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("flex h-full shrink-0 flex-col border-r border-line bg-sidebar", className)}
      aria-label="Primary"
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-teal/15 text-teal">
          <Hexagon className="h-5 w-5" />
        </span>
        {!collapsed ? (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-semibold tracking-tight">Seeknimbly</p>
            <p className="truncate text-[11px] text-muted">PhysicalOS</p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            {!collapsed ? <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted/80">{group.title}</p> : <div className="mx-2 mb-1 border-t border-line/60" />}
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
                        "group relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
                        active ? "bg-elevated font-medium text-fg" : "text-muted hover:bg-elevated/60 hover:text-fg",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-teal" aria-hidden /> : null}
                      <Icon className={cn("h-4 w-4 shrink-0", active && "text-teal")} aria-hidden />
                      {!collapsed ? <span className="truncate">{item.label}</span> : <span className="sr-only">{item.label}</span>}
                      {showBadge ? (
                        <span className={cn("mono rounded-full bg-amber/20 px-1.5 text-[10px] font-semibold text-amber", collapsed ? "absolute right-1 top-1" : "ml-auto")}>
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
          className="flex h-11 items-center gap-2 border-t border-line px-5 text-xs text-muted hover:text-fg"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed ? "Collapse" : null}
        </button>
      ) : null}
    </motion.aside>
  );
}
