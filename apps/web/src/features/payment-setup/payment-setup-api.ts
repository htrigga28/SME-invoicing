import { apiGet, apiRequest } from "@/lib/api";

import type {
  PaymentSetupAccount,
  PaymentSetupAccountResponse,
  PaymentSetupBank,
  ResolvedPaymentSetupAccount
} from "./types";

export function getPaymentSetupAccount(accessToken: string) {
  return apiGet<PaymentSetupAccountResponse>("/payment-setup/account", { accessToken });
}

export function listPaymentSetupBanks(accessToken: string) {
  return apiGet<{ banks: PaymentSetupBank[] }>("/payment-setup/banks", { accessToken });
}

export function resolvePaymentSetupAccount(
  accessToken: string,
  input: { accountNumber: string; bankCode: string }
) {
  return apiRequest<ResolvedPaymentSetupAccount>("/payment-setup/resolve-account", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function createPaymentSetupSubaccount(
  accessToken: string,
  input: { accountNumber: string; bankCode: string; confirmedAccountName: string }
) {
  return apiRequest<{ paymentAccount: PaymentSetupAccount }>("/payment-setup/subaccount", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function disablePaymentSetupAccount(accessToken: string, input: { reason?: string } = {}) {
  return apiRequest<{ paymentAccount: PaymentSetupAccount }>("/payment-setup/account/disable", {
    method: "POST",
    accessToken,
    body: input
  });
}

export function reactivatePaymentSetupAccount(
  accessToken: string,
  id: string,
  input: { reason?: string } = {}
) {
  return apiRequest<{ paymentAccount: PaymentSetupAccount }>(
    `/payment-setup/accounts/${encodeURIComponent(id)}/reactivate`,
    {
      method: "POST",
      accessToken,
      body: input
    }
  );
}
