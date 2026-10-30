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

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operate",
    items: [
      { href: "/", label: "Command Center", icon: LayoutDashboard },
      { href: "/factory", label: "Factory Floor", icon: Factory },
      { href: "/work-orders", label: "Work Orders", icon: ClipboardList },
    ],
  },
  {
    title: "Resources",
    items: [
      { href: "/workforce", label: "Workforce", icon: Users },
      { href: "/machines", label: "Machines", icon: Cog },
      { href: "/robots", label: "Robots", icon: Bot },
    ],
  },
  {
    title: "Automation",
    items: [
      { href: "/orchestration", label: "Orchestration", icon: Workflow },
      { href: "/approvals", label: "Approvals", icon: ShieldCheck },
      { href: "/executions", label: "Executions", icon: PlayCircle },
    ],
  },
  {
    title: "Data & Governance",
    items: [
      { href: "/datasets", label: "Datasets", icon: Database },
      { href: "/audit", label: "Audit Trail", icon: ScrollText },
    ],
  },
  { title: "System", items: [{ href: "/settings", label: "Settings", icon: Settings }] },
];

export const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
