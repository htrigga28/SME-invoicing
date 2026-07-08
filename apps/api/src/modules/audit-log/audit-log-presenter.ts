import type { AuditLog, User } from "../../database/schema";

export const auditLogCategories = [
  "authentication",
  "team",
  "customer",
  "invoice",
  "payment_setup",
  "payment",
  "reconciliation",
  "refund",
  "receipt",
  "export",
  "system"
] as const;

export type AuditLogCategory = (typeof auditLogCategories)[number];

export type SafeAuditMetadataField = {
  key: string;
  label: string;
  value: string;
};

type AuditLogRow = {
  actor: Pick<User, "email" | "id" | "name"> | null;
  auditLog: AuditLog;
};

const explicitActionCategories: Record<string, AuditLogCategory> = {
  business_profile_completed: "system",
  business_profile_updated: "system",
  export_generated: "export",
  invoice_status_updated: "invoice",
  payment_account_confirmed: "payment_setup",
  payment_account_created: "payment_setup",
  payment_account_disabled: "payment_setup",
  payment_account_reactivated: "payment_setup",
  payment_account_resolved: "payment_setup",
  payment_account_resolution_failed: "payment_setup",
  payment_account_subaccount_creation_failed: "payment_setup",
  payment_for_cancelled_or_void_invoice: "reconciliation",
  payment_refund_initiated: "refund",
  payment_refund_processed_invoice_adjustment: "refund",
  payment_refund_submission_failed: "refund",
  payment_verification_mismatch: "reconciliation",
  payment_webhook_duplicate_ignored: "reconciliation",
  payment_webhook_mismatch: "reconciliation",
  payment_webhook_unknown_reference: "reconciliation",
  receipt_generated: "receipt",
  team_invitation_accepted: "team",
  team_invitation_created: "team",
  team_invitation_revoked: "team",
  team_member_removed: "team",
  team_member_updated: "team",
  user_registered: "authentication"
};

const categoryPrefixes: { category: AuditLogCategory; prefix: string }[] = [
  { prefix: "team_", category: "team" },
  { prefix: "customer_", category: "customer" },
  { prefix: "invoice_", category: "invoice" },
  { prefix: "payment_account_", category: "payment_setup" },
  { prefix: "payment_refund_", category: "refund" },
  { prefix: "payment_webhook_", category: "reconciliation" },
  { prefix: "payment_verification_", category: "reconciliation" },
  { prefix: "payment_", category: "payment" },
  { prefix: "receipt_", category: "receipt" },
  { prefix: "export_", category: "export" },
  { prefix: "auth_", category: "authentication" },
  { prefix: "user_", category: "authentication" }
];

const safeSensitiveExceptions = new Set([
  "accountnumberlast4",
  "accountnumber_last4",
  "account_number_last4",
  "last4"
]);

const sensitiveKeyFragments = [
  "password",
  "passwordhash",
  "token",
  "tokenhash",
  "refreshtoken",
  "secret",
  "apikey",
  "authorization",
  "accountnumber",
  "providersubaccountcode",
  "publictoken",
  "rawpayload",
  "signature",
  "payloadredacted",
  "providermetadataredacted",
  "organisationid",
  "organizationid"
];

export function presentAuditLog(row: AuditLogRow) {
  const category = categorizeAuditAction(row.auditLog.action);
  const metadataFields = toSafeMetadataFields(row.auditLog.metadataRedacted);
  const resource = toResource(row.auditLog, metadataFields);
  const actor = row.actor
    ? {
        id: row.actor.id,
        name: row.actor.name,
        email: row.actor.email
      }
    : null;

  return {
    id: row.auditLog.id,
    action: row.auditLog.action,
    actionLabel: humanizeAction(row.auditLog.action),
    category,
    actor,
    actorLabel: actor ? `${actor.name} (${actor.email})` : "System",
    resource,
    metadataSummary: summarizeMetadata(metadataFields),
    metadataFields,
    createdAt: row.auditLog.createdAt
  };
}

export function categorizeAuditAction(action: string): AuditLogCategory {
  const explicit = explicitActionCategories[action];

  if (explicit) {
    return explicit;
  }

  return categoryPrefixes.find((item) => action.startsWith(item.prefix))?.category ?? "system";
}

export function humanizeAction(action: string) {
  return action
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function toSafeMetadataFields(
  metadata: Record<string, unknown> | null | undefined
): SafeAuditMetadataField[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  return Object.entries(metadata)
    .flatMap(([key, value]) => {
      if (isSensitiveMetadataKey(key)) {
        return [];
      }

      const formatted = formatMetadataValue(sanitizeMetadataValue(value));

      if (!formatted) {
        return [];
      }

      return [{ key, label: humanizeAction(key), value: formatted }];
    })
    .slice(0, 24);
}

export function summarizeMetadata(fields: SafeAuditMetadataField[]) {
  if (!fields.length) {
    return "";
  }

  return fields
    .slice(0, 4)
    .map((field) => `${field.label}: ${field.value}`)
    .join("; ");
}

function toResource(auditLog: AuditLog, fields: SafeAuditMetadataField[]) {
  if (!auditLog.entityId) {
    return null;
  }

  const labelField = fields.find((field) =>
    ["invoiceNumber", "receiptNumber", "providerReference", "email", "name", "dataset"].includes(
      field.key
    )
  );

  return {
    type: auditLog.entityType,
    id: auditLog.entityId,
    label: labelField?.value ?? auditLog.entityId
  };
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, nestedValue]) => {
      if (isSensitiveMetadataKey(key)) {
        return [];
      }

      return [[key, sanitizeMetadataValue(nestedValue)]];
    })
  );
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    const safeValues = value.map((item) => formatMetadataValue(item)).filter(Boolean);
    return safeValues.length ? safeValues.join(", ") : "";
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const formatted = formatMetadataValue(nestedValue);
        return formatted ? `${humanizeAction(key)} ${formatted}` : "";
      })
      .filter(Boolean);

    return entries.join(", ");
  }

  return "";
}

function isSensitiveMetadataKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();

  if (
    safeSensitiveExceptions.has(normalized) ||
    normalized.endsWith("accountlast4") ||
    normalized.endsWith("accountnumberlast4")
  ) {
    return false;
  }

  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}
