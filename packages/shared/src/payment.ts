import type { PaymentStatus } from "./constants";

export const RECONCILIATION_STATES = [
  "matched",
  "pending_confirmation",
  "stale_pending",
  "failed",
  "abandoned",
  "refunded",
  "superseded",
  "review_required",
  "unknown"
] as const;

export type ReconciliationState = (typeof RECONCILIATION_STATES)[number];

export const ATTEMPT_STATES = [
  "successful",
  "active_pending",
  "stale_pending",
  "failed_attempt",
  "abandoned_attempt",
  "refunded_attempt",
  "superseded",
  "review_required",
  "unknown"
] as const;

export type AttemptState = (typeof ATTEMPT_STATES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pending",
  successful: "Successful",
  failed: "Failed",
  abandoned: "Abandoned",
  refunded: "Refunded"
};

export const RECONCILIATION_STATE_LABELS: Record<ReconciliationState, string> = {
  matched: "Matched",
  pending_confirmation: "Pending confirmation",
  stale_pending: "Stale pending",
  failed: "Failed",
  abandoned: "Abandoned",
  refunded: "Refunded",
  superseded: "Superseded",
  review_required: "Review required",
  unknown: "Unknown"
};

export const ATTEMPT_STATE_LABELS: Record<AttemptState, string> = {
  successful: "Successful",
  active_pending: "Active pending",
  stale_pending: "Stale pending",
  failed_attempt: "Failed attempt",
  abandoned_attempt: "Abandoned attempt",
  refunded_attempt: "Refunded attempt",
  superseded: "Superseded",
  review_required: "Review required",
  unknown: "Unknown"
};
