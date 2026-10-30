import {
  Bot,
  Cog,
  Database,
  Factory,
  LayoutDashboard,
  ClipboardList,
  PlayCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Flat enterprise nav aligned with the Factory Operations console. */
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operate",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/factory", label: "Factory Floor", icon: Factory },
      { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
    ],
  },
  {
    title: "Resources",
    items: [
      { href: "/workforce", label: "Workforce", icon: Users },
      { href: "/machines", label: "Machines", icon: Cog },
      { href: "/robots", label: "Robots & Machines", icon: Bot },
    ],
  },
  {
    title: "Automation",
    items: [
      { href: "/orchestration", label: "AI Assistant", icon: Workflow },
      { href: "/approvals", label: "Approvals", icon: ShieldCheck },
      { href: "/executions", label: "Schedule", icon: PlayCircle },
    ],
  },
  {
    title: "Governance",
    items: [
      { href: "/datasets", label: "Analytics", icon: Database },
      { href: "/audit", label: "Audit Log", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
