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
    | "products"
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

const overviewRoutes: AppRoute[] = [
  { href: "/dashboard", icon: "dashboard", label: "Overview", status: "available" }
];

const receivablesRoutes: AppRoute[] = [
  { href: "/invoices", icon: "invoices", label: "Invoices", status: "available" },
  { href: "/recurring-invoices", icon: "invoices", label: "Recurring", status: "available" },
  { href: "/customers", icon: "customers", label: "Customers", status: "available" },
  { href: "/payments", icon: "payments", label: "Payments", status: "available" },
  { href: "/receipts", icon: "receipts", label: "Receipts", status: "available" },
  {
    href: "/products-services",
    icon: "products",
    label: "Products & Services",
    status: "available"
  }
];

const operationsRoutes: AppRoute[] = [
  {
    href: "/exports",
    icon: "exports",
    label: "Exports",
    status: "available",
    allowedRoles: ["owner", "admin", "accountant"]
  }
];

const settingsRoutes: AppRoute[] = [
  {
    href: "/settings/payment-setup",
    icon: "settings",
    label: "Payment setup",
    status: "available"
  },
  {
    href: "/settings/reminders",
    icon: "settings",
    label: "Payment reminders",
    status: "available",
    allowedRoles: ["owner", "admin"]
  },
  {
    href: "/settings/team",
    icon: "team",
    label: "Team",
    status: "available",
    allowedRoles: ["owner", "admin"]
  },
  {
    href: "/audit-logs",
    icon: "audit",
    label: "Audit log",
    status: "available",
    allowedRoles: ["owner", "admin"]
  }
];

export const navigationSections: NavigationSection[] = [
  { label: "Overview", items: overviewRoutes },
  { label: "Receivables", items: receivablesRoutes },
  { label: "Operations", items: operationsRoutes },
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
