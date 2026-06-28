import {
  Building2,
  CalendarDays,
  DoorOpen,
  LayoutGrid,
  type LucideIcon,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  UserCheck,
  Users,
  Video,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    label: "OPERATIONS",
    items: [
      { id: "dashboard", label: "Command Center", href: "/", icon: LayoutGrid },
      { id: "incidents", label: "ASRS Incidents", href: "/incidents", icon: TriangleAlert },
      { id: "surveillance", label: "Surveillance", href: "/surveillance", icon: Video },
      { id: "access", label: "Access Control", href: "/access", icon: DoorOpen },
      { id: "assets", label: "Assets & Protocols", href: "/assets", icon: Truck },
    ],
  },
  {
    label: "DIRECTORY",
    items: [
      { id: "visitors", label: "Visitors", href: "/visitors", icon: UserCheck },
      { id: "appointments", label: "Appointments", href: "/appointments", icon: CalendarDays },
      { id: "staff", label: "Staff Registry", href: "/staff", icon: Building2 },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { id: "users", label: "Users & Roles", href: "/users", icon: Users },
      { id: "settings", label: "System Rules", href: "/settings", icon: SlidersHorizontal },
    ],
  },
];

/** Map a pathname to its view id (for titles + active state). */
export function viewIdForPath(pathname: string): string {
  if (pathname === "/") return "dashboard";
  const seg = pathname.split("/")[1];
  return seg || "dashboard";
}
