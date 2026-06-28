import type { Membership } from "@/features/auth/types";

export type AppRoute = {
  href: string;
  label: string;
  status: "available" | "coming-soon";
  task?: string;
  allowedRoles?: Membership["role"][];
};

export const appRoutes: AppRoute[] = [
  { href: "/dashboard", label: "Dashboard", status: "available" },
  { href: "/customers", label: "Customers", status: "coming-soon", task: "T005" },
  { href: "/invoices", label: "Invoices", status: "coming-soon", task: "T006" },
  { href: "/payments", label: "Payments", status: "coming-soon", task: "T010" },
  { href: "/receipts", label: "Receipts", status: "coming-soon", task: "T011" },
  { href: "/exports", label: "Exports", status: "coming-soon", task: "T013" },
  {
    href: "/audit-logs",
    label: "Audit Logs",
    status: "coming-soon",
    task: "T013",
    allowedRoles: ["owner", "admin"]
  },
  {
    href: "/settings/team",
    label: "Settings / Team",
    status: "available",
    allowedRoles: ["owner", "admin"]
  }
];

export function getNavigationItems(role: Membership["role"]) {
  return appRoutes.filter((route) => !route.allowedRoles || route.allowedRoles.includes(role));
}
