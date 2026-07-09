import type { Membership } from "@/features/auth/types";

export type AppRoute = {
  href: string;
  icon:
    | "audit"
    | "customers"
    | "dashboard"
    | "exports"
    | "invoices"
    | "payments"
    | "receipts"
    | "settings"
    | "team";
  label: string;
  status: "available" | "coming-soon";
  task?: string;
  allowedRoles?: Membership["role"][];
};

export type NavigationSection = {
  label: string;
  items: AppRoute[];
};

const mainRoutes: AppRoute[] = [
  { href: "/dashboard", icon: "dashboard", label: "Dashboard", status: "available" },
  { href: "/customers", icon: "customers", label: "Customers", status: "available" },
  { href: "/invoices", icon: "invoices", label: "Invoices", status: "available" },
  { href: "/payments", icon: "payments", label: "Payments", status: "available" },
  { href: "/receipts", icon: "receipts", label: "Receipts", status: "available" },
  {
    href: "/exports",
    icon: "exports",
    label: "Exports",
    status: "available",
    allowedRoles: ["owner", "admin", "accountant"]
  },
  {
    href: "/audit-logs",
    icon: "audit",
    label: "Audit Logs",
    status: "available",
    allowedRoles: ["owner", "admin"]
  }
];

const settingsRoutes: AppRoute[] = [
  {
    href: "/settings/team",
    icon: "team",
    label: "Team",
    status: "available",
    allowedRoles: ["owner", "admin"]
  },
  {
    href: "/settings/payment-setup",
    icon: "settings",
    label: "Payment Setup",
    status: "available"
  }
];

export const navigationSections: NavigationSection[] = [
  { label: "Main", items: mainRoutes },
  { label: "Settings", items: settingsRoutes }
];

export function getNavigationItems(role: Membership["role"]) {
  return navigationSections.flatMap((section) => section.items).filter(isRouteVisible(role));
}

export function getNavigationSections(role: Membership["role"]) {
  return navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter(isRouteVisible(role))
    }))
    .filter((section) => section.items.length > 0);
}

function isRouteVisible(role: Membership["role"]) {
  return (route: AppRoute) => !route.allowedRoles || route.allowedRoles.includes(role);
}
