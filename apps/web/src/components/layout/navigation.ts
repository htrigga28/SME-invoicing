import type { Membership } from "@/features/auth/types";

export type AppRoute = {
  href: string;
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
  { href: "/dashboard", label: "Dashboard", status: "available" },
  { href: "/customers", label: "Customers", status: "available" },
  { href: "/invoices", label: "Invoices", status: "available" },
  { href: "/payments", label: "Payments", status: "coming-soon", task: "T013" },
  { href: "/receipts", label: "Receipts", status: "coming-soon", task: "T014" },
  { href: "/exports", label: "Exports", status: "coming-soon", task: "T016" },
  {
    href: "/audit-logs",
    label: "Audit Logs",
    status: "coming-soon",
    task: "T016",
    allowedRoles: ["owner", "admin"]
  }
];

const settingsRoutes: AppRoute[] = [
  {
    href: "/settings/team",
    label: "Team",
    status: "available",
    allowedRoles: ["owner", "admin"]
  },
  {
    href: "/settings/payment-setup",
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
