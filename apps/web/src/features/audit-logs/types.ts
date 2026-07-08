import type { Pagination } from "@/features/customers/types";

export type AuditLogCategory =
  | "authentication"
  | "customer"
  | "export"
  | "invoice"
  | "payment"
  | "payment_setup"
  | "receipt"
  | "reconciliation"
  | "refund"
  | "system"
  | "team";

export type AuditMetadataField = {
  key: string;
  label: string;
  value: string;
};

export type AuditActor = {
  id: string;
  email: string;
  name: string;
} | null;

export type AuditResource = {
  id: string;
  label: string;
  type: string;
} | null;

export type AuditLogListItem = {
  id: string;
  action: string;
  actionLabel: string;
  category: AuditLogCategory;
  actor: AuditActor;
  actorLabel: string;
  resource: AuditResource;
  metadataSummary: string;
  createdAt: string;
};

export type AuditLogDetail = AuditLogListItem & {
  metadataFields: AuditMetadataField[];
};

export type AuditLogListResponse = {
  auditLogs: AuditLogListItem[];
  pagination: Pagination;
};

export type AuditLogDetailResponse = {
  auditLog: AuditLogDetail;
};
