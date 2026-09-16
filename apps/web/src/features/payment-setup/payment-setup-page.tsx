"use client";

import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { PageHeader as SharedPageHeader } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Alert, type AlertTone } from "@/components/ui/feedback";
import { FieldError, FieldHint, FieldLabel, FormField, Input } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { StatusBadge as SharedStatusBadge } from "@/components/ui/status-badge";
import type { Membership } from "@/features/auth/types";
import { clearStoredSession } from "@/features/auth/session";
import { getApiErrorMessage, isApiRequestError } from "@/lib/api";

import {
  createPaymentSetupSubaccount,
  disablePaymentSetupAccount,
  getPaymentSetupAccount,
  listPaymentSetupBanks,
  reactivatePaymentSetupAccount,
  resolvePaymentSetupAccount
} from "./payment-setup-api";
import type {
  PaymentSetupAccount,
  PaymentSetupAccountResponse,
  PaymentSetupBank,
  ResolvedPaymentSetupAccount
} from "./types";
import { canManagePaymentSetup } from "./types";

type LoadState = "loading" | "ready" | "error";
type BankLoadState = "idle" | "loading" | "ready" | "error";

export function PaymentSetupPage() {
  return (
    <AppShell>
      {({ accessToken, me }) => (
        <PaymentSetupContent
          accessToken={accessToken}
          onboardingMode={me.onboardingStep === "payment_setup"}
          role={me.membership.role}
        />
      )}
    </AppShell>
  );
}

export function PaymentSetupContent({
  accessToken,
  onboardingMode = false,
  role
}: {
  accessToken: string;
  onboardingMode?: boolean;
  role: Membership["role"];
}) {
  const searchParams = useSearchParams();
  const fromOnboarding = onboardingMode || searchParams.get("source") === "onboarding";
  const [accountResponse, setAccountResponse] = useState<PaymentSetupAccountResponse | null>(null);
  const [accountState, setAccountState] = useState<LoadState>("loading");
  const [pageError, setPageError] = useState<string | null>(null);
  const [banks, setBanks] = useState<PaymentSetupBank[]>([]);
  const [bankState, setBankState] = useState<BankLoadState>("idle");
  const [bankLoadError, setBankLoadError] = useState<string | null>(null);
  const [selectedBankCode, setSelectedBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedAccount, setResolvedAccount] = useState<ResolvedPaymentSetupAccount | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [reactivationError, setReactivationError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [showDifferentAccountSetup, setShowDifferentAccountSetup] = useState(false);
  const canManage = canManagePaymentSetup(role);
  const currentAccount = accountResponse?.paymentAccount ?? null;
  const shouldShowWizard =
    canManage &&
    accountState === "ready" &&
    (!currentAccount || (currentAccount.status === "disabled" && showDifferentAccountSetup));
  const accountNumberIsValid = /^\d{10}$/.test(accountNumber);
  const selectedBank = useMemo(
    () => banks.find((bank) => bank.code === selectedBankCode) ?? null,
    [banks, selectedBankCode]
  );

  useEffect(() => {
    void loadAccount();
  }, [accessToken]);

  useEffect(() => {
    if (shouldShowWizard && bankState === "idle") {
      void loadBanks();
    }
  }, [shouldShowWizard, bankState]);

  useEffect(() => {
    if (fromOnboarding) {
      toast.success("Business profile completed. Next, activate online payments.", {
        id: "payment-setup-onboarding"
      });
    }
  }, [fromOnboarding]);

  async function loadAccount() {
    setAccountState("loading");
    setPageError(null);

    try {
      const response = await getPaymentSetupAccount(accessToken);
      setAccountResponse(response);
      setAccountState("ready");
    } catch (loadError) {
      handleAuthError(loadError);
      setPageError(getApiErrorMessage(loadError, "Could not load payment setup."));
      setAccountState("error");
    }
  }

  async function loadBanks() {
    setBankState("loading");
    setBankLoadError(null);

    try {
      const response = await listPaymentSetupBanks(accessToken);
      setBanks(response.banks);
      setBankState("ready");
    } catch (loadError) {
      handleAuthError(loadError);
      const message = getApiErrorMessage(loadError, "Could not load banks.");
      setBankLoadError(message);
      setBankState("error");
      toast.error(message, { id: "payment-setup-banks" });
    }
  }

  function handleAuthError(loadError: unknown) {
    if (isApiRequestError(loadError) && loadError.status === 401) {
      clearStoredSession();
      window.location.assign("/login");
    }
  }

  function handleAccountNumberChange(value: string) {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
    setAccountNumber(digitsOnly);
    setResolvedAccount(null);
    setResolveError(null);
    setActivationError(null);
    setReactivationError(null);
  }

  async function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResolveError(null);
    setActivationError(null);
    setDisableError(null);
    setReactivationError(null);

    if (!selectedBankCode) {
      setResolveError("Select a bank.");
      return;
    }

    if (!accountNumberIsValid) {
      setResolveError("Enter a 10-digit Nigerian account number.");
      return;
    }

    setIsResolving(true);

    try {
      const resolved = await resolvePaymentSetupAccount(accessToken, {
        bankCode: selectedBankCode,
        accountNumber
      });
      setResolvedAccount(resolved);
      toast.success("Account resolved. Please confirm the account name.", {
        id: "payment-setup-resolved"
      });
    } catch (resolveError) {
      handleAuthError(resolveError);
      setResolveError(getApiErrorMessage(resolveError, "Could not resolve this account."));
    } finally {
      setIsResolving(false);
    }
  }

  async function handleCreateSubaccount() {
    if (!resolvedAccount || !accountNumberIsValid) {
      return;
    }

    setActivationError(null);
    setDisableError(null);
    setReactivationError(null);
    setIsCreating(true);

    try {
      const response = await createPaymentSetupSubaccount(accessToken, {
        bankCode: resolvedAccount.bankCode,
        accountNumber,
        confirmedAccountName: resolvedAccount.accountName
      });
      setAccountResponse({
        status: response.paymentAccount.status,
        paymentAccount: response.paymentAccount
      });
      const verificationDelayed = response.paymentAccount.status === "verification_delayed";
      if (verificationDelayed) {
        toast.warning("Payment Setup submitted. Paystack verification is still in progress.", {
          id: "payment-setup-activated"
        });
      } else {
        toast.success("Payment Setup activated. You're ready to create your first invoice.", {
          id: "payment-setup-activated"
        });
      }
      resetWizard();
      setShowDifferentAccountSetup(false);
      setBankState("idle");
      setBankLoadError(null);

      if (fromOnboarding) {
        window.setTimeout(() => {
          window.location.assign("/dashboard?onboarding=complete");
        }, 600);
      }
    } catch (createError) {
      handleAuthError(createError);
      const message = getApiErrorMessage(createError, "Could not activate payment setup.");
      setActivationError(message);
      toast.error(message, { id: "payment-setup-activation-error" });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDisableAccount() {
    setDisableError(null);
    setIsDisabling(true);

    try {
      const response = await disablePaymentSetupAccount(accessToken, {
        reason: "Disabled from Payment Setup settings."
      });
      setAccountResponse({
        status: response.paymentAccount.status,
        paymentAccount: response.paymentAccount
      });
      setDisableDialogOpen(false);
      resetWizard();
      setShowDifferentAccountSetup(false);
      setBankState("idle");
      setBankLoadError(null);
      toast.success("Payment setup disabled.", { id: "payment-setup-disabled" });
    } catch (disableError) {
      handleAuthError(disableError);
      const message = getApiErrorMessage(disableError, "Could not disable payment setup.");
      setDisableError(message);
      toast.error(message, { id: "payment-setup-disable-error" });
    } finally {
      setIsDisabling(false);
    }
  }

  async function handleReactivateAccount() {
    if (!currentAccount) {
      return;
    }

    setReactivationError(null);
    setDisableError(null);
    setIsReactivating(true);

    try {
      const response = await reactivatePaymentSetupAccount(accessToken, currentAccount.id, {
        reason: "Reactivated from Payment Setup settings."
      });
      setAccountResponse({
        status: response.paymentAccount.status,
        paymentAccount: response.paymentAccount
      });
      setReactivateDialogOpen(false);
      resetWizard();
      setShowDifferentAccountSetup(false);
      setBankState("idle");
      setBankLoadError(null);
      toast.success("Payment setup reactivated.", { id: "payment-setup-reactivated" });
    } catch (reactivateError) {
      handleAuthError(reactivateError);
      const message = getApiErrorMessage(reactivateError, "Could not reactivate payment setup.");
      setReactivationError(message);
      toast.error(message, { id: "payment-setup-reactivate-error" });
    } finally {
      setIsReactivating(false);
    }
  }

  function resetWizard() {
    setSelectedBankCode("");
    setAccountNumber("");
    setResolvedAccount(null);
    setResolveError(null);
    setActivationError(null);
  }

  return (
    <section className="space-y-5">
      <PageHeader
        description={
          fromOnboarding
            ? "Connect the Nigerian bank account where confirmed invoice payments should settle."
            : "Configure where invoice payments should settle."
        }
        eyebrow={fromOnboarding ? "Signup" : "Settings"}
        title="Payment Setup"
      />

      {fromOnboarding ? (
        <StatusPanel
          message="Resolve and confirm your payout account to finish signup. If Paystack needs more time to verify it, you can still enter the workspace after submission."
          title="Final step: connect payouts"
          tone="info"
        />
      ) : null}

      <StatusPanel
        message="Online invoice payments require a verified payout account."
        tone="info"
      />

      {accountState === "loading" ? <StatusPanel message="Loading payment setup..." /> : null}

      {accountState === "error" ? (
        <StatusPanel
          action={
            <Button onClick={() => void loadAccount()} size="sm" type="button">
              Retry
            </Button>
          }
          message={pageError ?? "Please try loading Payment Setup again."}
          title="Could not load payment setup"
          tone="error"
        />
      ) : null}

      {accountState === "ready" && !currentAccount && !canManage ? (
        <StatusPanel
          message="Payment setup has not been completed. Ask an Owner or Admin to configure payouts."
          tone="warning"
        />
      ) : null}

      {accountState === "ready" && currentAccount ? (
        <PaymentAccountStatusCard
          account={currentAccount}
          canManage={canManage}
          errorMessage={disableError ?? reactivationError}
          onDisable={() => setDisableDialogOpen(true)}
          onReactivate={() => setReactivateDialogOpen(true)}
          onSetupDifferent={() => setShowDifferentAccountSetup(true)}
          showDifferentAccountSetup={showDifferentAccountSetup}
        />
      ) : null}

      {shouldShowWizard ? (
        <SetupWizard
          accountNumber={accountNumber}
          accountNumberIsValid={accountNumberIsValid}
          activationError={activationError}
          bankLoadError={bankLoadError}
          bankState={bankState}
          banks={banks}
          isCreating={isCreating}
          isResolving={isResolving}
          onAccountNumberChange={handleAccountNumberChange}
          onConfirm={() => void handleCreateSubaccount()}
          onResolve={handleResolve}
          onRetryBanks={() => void loadBanks()}
          onSelectedBankChange={(bankCode) => {
            setSelectedBankCode(bankCode);
            setResolvedAccount(null);
            setResolveError(null);
            setActivationError(null);
          }}
          resolveError={resolveError}
          resolvedAccount={resolvedAccount}
          selectedBank={selectedBank}
          selectedBankCode={selectedBankCode}
        />
      ) : null}

      <ConfirmDialog
        confirmLabel="Disable account"
        description="Online payment settlement will stop using this payout account. This does not delete the Paystack subaccount."
        destructive
        isLoading={isDisabling}
        loadingLabel="Disabling..."
        onCancel={() => setDisableDialogOpen(false)}
        onConfirm={() => void handleDisableAccount()}
        open={disableDialogOpen}
        title="Disable payout account?"
      />

      <ConfirmDialog
        confirmLabel="Reactivate account"
        description={
          currentAccount
            ? `Future online invoice payments will settle to this Paystack payout account ending ****${currentAccount.accountNumberLast4}.`
            : "Future online invoice payments will settle to this Paystack payout account."
        }
        isLoading={isReactivating}
        loadingLabel="Reactivating..."
        onCancel={() => setReactivateDialogOpen(false)}
        onConfirm={() => void handleReactivateAccount()}
        open={reactivateDialogOpen}
        title="Reactivate payout account?"
      />
    </section>
  );
}

function SetupWizard({
  accountNumber,
  accountNumberIsValid,
  activationError,
  bankLoadError,
  bankState,
  banks,
  isCreating,
  isResolving,
  onAccountNumberChange,
  onConfirm,
  onResolve,
  onRetryBanks,
  onSelectedBankChange,
  resolveError,
  resolvedAccount,
  selectedBank,
  selectedBankCode
}: {
  accountNumber: string;
  accountNumberIsValid: boolean;
  activationError: string | null;
  bankLoadError: string | null;
  bankState: BankLoadState;
  banks: PaymentSetupBank[];
  isCreating: boolean;
  isResolving: boolean;
  onAccountNumberChange: (value: string) => void;
  onConfirm: () => void;
  onResolve: (event: FormEvent<HTMLFormElement>) => void;
  onRetryBanks: () => void;
  onSelectedBankChange: (bankCode: string) => void;
  resolveError: string | null;
  resolvedAccount: ResolvedPaymentSetupAccount | null;
  selectedBank: PaymentSetupBank | null;
  selectedBankCode: string;
}) {
  return (
    <div
      className={`grid gap-5 ${
        resolvedAccount ? "xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]" : ""
      }`}
    >
      <Card className="p-5">
        <form onSubmit={onResolve}>
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Resolve account</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
              Select bank and enter account number
            </h2>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
            <FormField htmlFor="payment-setup-bank">
              <FieldLabel>Bank</FieldLabel>
              <Select
                id="payment-setup-bank"
                disabled={bankState === "loading"}
                onChange={(event) => onSelectedBankChange(event.target.value)}
                value={selectedBankCode}
                wrapperClassName="mt-1"
              >
                <option value="">
                  {bankState === "loading" ? "Loading banks..." : "Select bank"}
                </option>
                {banks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField htmlFor="payment-setup-account-number">
              <FieldLabel>Account number</FieldLabel>
              <Input
                aria-describedby={
                  accountNumber && !accountNumberIsValid
                    ? "payment-account-number-error"
                    : undefined
                }
                aria-invalid={Boolean(accountNumber && !accountNumberIsValid)}
                autoComplete="off"
                className="mt-1 font-mono tabular-nums"
                id="payment-setup-account-number"
                inputMode="numeric"
                maxLength={10}
                onChange={(event) => onAccountNumberChange(event.target.value)}
                placeholder="10 digits"
                value={accountNumber}
              />
            </FormField>
          </div>

          {accountNumber && !accountNumberIsValid ? (
            <FieldError id="payment-account-number-error">
              Enter the complete 10-digit Nigerian account number.
            </FieldError>
          ) : null}

          {resolveError ? <FieldError role="alert">{resolveError}</FieldError> : null}

          {bankState === "error" ? (
            <StatusPanel
              action={
                <Button onClick={onRetryBanks} size="sm" type="button">
                  Retry
                </Button>
              }
              message={bankLoadError ?? "Please try loading the bank list again."}
              title="Could not load banks"
              tone="error"
            />
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              disabled={!selectedBankCode || !accountNumberIsValid || isResolving || isCreating}
              isLoading={isResolving}
              loadingLabel="Resolving account..."
              type="submit"
            >
              Resolve account
            </Button>
          </div>
          {!resolvedAccount ? (
            <FieldHint className="mt-4">
              Confirmation appears after Paystack resolves the account name. Lumina stores only the
              masked account details after activation.
            </FieldHint>
          ) : null}
        </form>
      </Card>

      {resolvedAccount ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-[var(--accent)]">Confirm account</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">
            Confirm resolved account
          </h2>

          <div className="mt-5 space-y-4">
            <dl className="grid gap-3 text-sm">
              <InfoRow label="Bank name" value={resolvedAccount.bankName} />
              <InfoRow
                label="Account number"
                value={maskLast4(resolvedAccount.accountNumberLast4)}
              />
              <InfoRow label="Account name" value={resolvedAccount.accountName} />
            </dl>
            <p className="text-sm text-[var(--text-secondary)]">
              Confirm this is your business payout account before activation.
            </p>
            {activationError ? <FieldError role="alert">{activationError}</FieldError> : null}
            <Button
              disabled={isCreating || !accountNumberIsValid || !selectedBank}
              isLoading={isCreating}
              loadingLabel="Activating payouts..."
              onClick={onConfirm}
              size="lg"
              type="button"
            >
              Confirm and activate payouts
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function PaymentAccountStatusCard({
  account,
  canManage,
  errorMessage,
  onDisable,
  onReactivate,
  onSetupDifferent,
  showDifferentAccountSetup
}: {
  account: PaymentSetupAccount;
  canManage: boolean;
  errorMessage: string | null;
  onDisable: () => void;
  onReactivate: () => void;
  onSetupDifferent: () => void;
  showDifferentAccountSetup: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Payout account</h2>
            <StatusBadge status={account.status} />
          </div>
          {account.status === "active" ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Public invoice payments use this Paystack payout account.
            </p>
          ) : null}
          {account.status === "verification_delayed" ? (
            <p className="mt-2 text-sm text-[var(--warning)]" role="status">
              Paystack may require additional verification before settlement is fully active.
            </p>
          ) : null}
          {account.status === "disabled" ? (
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              This payout account is disabled. You can reactivate it or set up a different payout
              account.
            </p>
          ) : null}
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {account.status === "disabled" ? (
              <>
                <Button onClick={onReactivate} type="button">
                  Reactivate this account
                </Button>
                <Button onClick={onSetupDifferent} type="button" variant="outline">
                  Set up a different account
                </Button>
              </>
            ) : (
              <Button onClick={onDisable} type="button" variant="destructive">
                Disable account
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <Alert className="mt-4" role="alert" tone="error">
          {errorMessage}
        </Alert>
      ) : null}

      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
        <InfoRow label="Provider" value="Paystack" />
        <InfoRow label="Bank" value={account.bankName} />
        <InfoRow label="Account name" value={account.accountName} />
        <InfoRow label="Masked account" value={maskLast4(account.accountNumberLast4)} />
        <InfoRow
          label="Verified at"
          value={account.verifiedAt ? formatDate(account.verifiedAt) : "Not verified"}
        />
        <InfoRow label="Updated" value={formatDate(account.updatedAt)} />
      </dl>

      {account.status === "disabled" && canManage && showDifferentAccountSetup ? (
        <p className="mt-5 text-sm text-[var(--text-secondary)]">
          Use this if you want payments to settle to a different bank account.
        </p>
      ) : null}
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function PageHeader({
  description,
  eyebrow,
  title
}: {
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return <SharedPageHeader description={description} eyebrow={eyebrow} title={title} />;
}

function StatusPanel({
  action,
  message,
  title,
  tone = "info"
}: {
  action?: React.ReactNode;
  message: string;
  title?: string;
  tone?: "error" | "info" | "success" | "warning";
}) {
  return (
    <Alert action={action} tone={tone as AlertTone}>
      {title ? <h2 className="font-semibold">{title}</h2> : null}
      <p className={title ? "mt-1" : undefined}>{message}</p>
    </Alert>
  );
}

function StatusBadge({ status }: { status: PaymentSetupAccount["status"] }) {
  return <SharedStatusBadge status={status}>{statusLabel(status)}</SharedStatusBadge>;
}

function statusLabel(status: PaymentSetupAccount["status"]) {
  const labels = {
    active: "Active",
    disabled: "Disabled",
    pending_confirmation: "Pending confirmation",
    verification_delayed: "Verification delayed"
  };

  return labels[status];
}

function maskLast4(last4: string) {
  return `******${last4}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
