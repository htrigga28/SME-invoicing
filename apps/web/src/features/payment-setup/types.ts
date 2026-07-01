import type { Membership } from "@/features/auth/types";

export type PaymentAccountStatus =
  | "pending_confirmation"
  | "active"
  | "verification_delayed"
  | "disabled";

export type PaymentSetupStatus = "not_configured" | PaymentAccountStatus;

export type PaymentSetupAccount = {
  id: string;
  provider: "paystack" | string;
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
  status: PaymentAccountStatus;
  verifiedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentSetupAccountResponse =
  | {
      status: "not_configured";
      paymentAccount: null;
    }
  | {
      status: PaymentAccountStatus;
      paymentAccount: PaymentSetupAccount;
    };

export type PaymentSetupBank = {
  active: boolean;
  code: string;
  country: string;
  currency: string;
  name: string;
};

export type ResolvedPaymentSetupAccount = {
  bankCode: string;
  bankName: string;
  accountNumberLast4: string;
  accountName: string;
};

export const paymentSetupManagerRoles = [
  "owner",
  "admin"
] as const satisfies readonly Membership["role"][];

export function canManagePaymentSetup(role: Membership["role"]) {
  return paymentSetupManagerRoles.includes(role as (typeof paymentSetupManagerRoles)[number]);
}
