import { ComingSoonPage } from "@/components/layout/coming-soon-page";

const auditLogRoles = ["owner", "admin"] as const;

export default function AuditLogsPage() {
  return (
    <ComingSoonPage
      description="Audit logs will be implemented in T013."
      deniedMessage="Owner or Admin access is required for audit logs."
      requiredRoles={auditLogRoles}
      taskId="T013"
      title="Audit Logs"
    />
  );
}
