"use client";

import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import {
  compactPrimaryActionClassName,
  destructiveActionClassName,
  primaryActionClassName
} from "@/components/ui/styles";
import type { Membership } from "@/features/auth/types";
import { clearStoredSession } from "@/features/auth/session";
import { getApiErrorMessage, isApiRequestError } from "@/lib/api";

import {
  createPaymentSetupSubaccount,
  disablePaymentSetupAccount,
  getPaymentSetupAccount,
  listPaymentSetupBanks,
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
        <PaymentSetupContent accessToken={accessToken} role={me.membership.role} />
      )}
    </AppShell>
  );
}

export function PaymentSetupContent({
  accessToken,
  role
}: {
  accessToken: string;
  role: Membership["role"];
}) {
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get("source") === "onboarding";
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
  const [isResolving, setIsResolving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const canManage = canManagePaymentSetup(role);
  const currentAccount = accountResponse?.paymentAccount ?? null;
  const shouldShowWizard =
    canManage &&
    accountState === "ready" &&
    (!currentAccount || currentAccount.status === "disabled");
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
  }

  async function handleResolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResolveError(null);
    setActivationError(null);
    setDisableError(null);

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
      toast.success("Payment setup activated.", { id: "payment-setup-activated" });
      resetWizard();
      setBankState("idle");
      setBankLoadError(null);
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
        description="Configure where invoice payments should settle."
        eyebrow="Settings"
        title="Payment Setup"
      />

      {fromOnboarding ? (
        <StatusPanel
          message="You can create invoices now, but customers cannot pay online until payouts are configured."
          title="Next: activate online payments"
          tone="warning"
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
            <button
              className={compactPrimaryActionClassName}
              onClick={() => void loadAccount()}
              type="button"
            >
              Retry
            </button>
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
          errorMessage={disableError}
          onDisable={() => setDisableDialogOpen(true)}
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
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <form className="rounded-lg border border-slate-200 bg-white p-5" onSubmit={onResolve}>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Step 1</p>
          <h2 className="text-xl font-semibold text-slate-950">
            Select bank and enter account number
          </h2>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Bank</span>
            <Select
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
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Account number</span>
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              inputMode="numeric"
              maxLength={10}
              onChange={(event) => onAccountNumberChange(event.target.value)}
              placeholder="10 digits"
              value={accountNumber}
            />
          </label>
        </div>

        {accountNumber && !accountNumberIsValid ? (
          <p className="mt-3 text-sm text-red-700">Enter a 10-digit Nigerian account number.</p>
        ) : null}

        {resolveError ? <p className="mt-3 text-sm text-red-700">{resolveError}</p> : null}

        {bankState === "error" ? (
          <StatusPanel
            action={
              <button
                className={compactPrimaryActionClassName}
                onClick={onRetryBanks}
                type="button"
              >
                Retry
              </button>
            }
            message={bankLoadError ?? "Please try loading the bank list again."}
            title="Could not load banks"
            tone="error"
          />
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className={primaryActionClassName}
            disabled={!selectedBankCode || !accountNumberIsValid || isResolving || isCreating}
            type="submit"
          >
            {isResolving ? "Resolving..." : "Resolve account"}
          </button>
        </div>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">Step 2</p>
        <h2 className="text-xl font-semibold text-slate-950">Confirm resolved account</h2>

        {resolvedAccount ? (
          <div className="mt-5 space-y-4">
            <dl className="grid gap-3 text-sm">
              <InfoRow label="Bank name" value={resolvedAccount.bankName} />
              <InfoRow
                label="Account number"
                value={maskLast4(resolvedAccount.accountNumberLast4)}
              />
              <InfoRow label="Account name" value={resolvedAccount.accountName} />
            </dl>
            <p className="text-sm text-slate-600">Confirm this is your business payout account.</p>
            {activationError ? <p className="text-sm text-red-700">{activationError}</p> : null}
            <button
              className={primaryActionClassName}
              disabled={isCreating || !accountNumberIsValid || !selectedBank}
              onClick={onConfirm}
              type="button"
            >
              {isCreating ? "Activating..." : "Confirm and activate payouts"}
            </button>
          </div>
        ) : (
          <p className="mt-5 text-sm text-slate-600">
            Resolve an account to review the Paystack account name before activation.
          </p>
        )}
      </section>
    </div>
  );
}

function PaymentAccountStatusCard({
  account,
  canManage,
  errorMessage,
  onDisable
}: {
  account: PaymentSetupAccount;
  canManage: boolean;
  errorMessage: string | null;
  onDisable: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-950">Payout account</h2>
            <StatusBadge status={account.status} />
          </div>
          {account.status === "active" ? (
            <p className="mt-2 text-sm text-slate-600">
              Public invoice payments will use this Paystack subaccount after T012 is completed.
            </p>
          ) : null}
          {account.status === "verification_delayed" ? (
            <p className="mt-2 text-sm text-amber-800">
              Paystack may require additional verification before settlement is fully active.
            </p>
          ) : null}
          {account.status === "disabled" ? (
            <p className="mt-2 text-sm text-slate-600">
              This payout account is disabled. Owner/Admin users can configure a new one below.
            </p>
          ) : null}
        </div>
        {canManage && account.status !== "disabled" ? (
          <button className={destructiveActionClassName} onClick={onDisable} type="button">
            Disable account
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3">
        <InfoRow label="Provider" value="Paystack" />
        <InfoRow label="Bank" value={account.bankName} />
        <InfoRow label="Account name" value={account.accountName} />
        <InfoRow label="Account last4" value={account.accountNumberLast4} />
        <InfoRow
          label="Verified at"
          value={account.verifiedAt ? formatDate(account.verifiedAt) : "Not verified"}
        />
        <InfoRow label="Updated" value={formatDate(account.updatedAt)} />
      </dl>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-950">{value}</dd>
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
  return (
    <div>
      {eyebrow ? (
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">{eyebrow}</p>
      ) : null}
      <h1 className="text-3xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
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
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700",
    info: "border-slate-200 bg-white text-slate-600",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800"
  };

  return (
    <section className={`rounded-lg border p-5 text-sm ${styles[tone]}`}>
      {title ? <h2 className="font-semibold">{title}</h2> : null}
      <p className={title ? "mt-1" : undefined}>{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  );
}

function StatusBadge({ status }: { status: PaymentSetupAccount["status"] }) {
  const styles = {
    active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    disabled: "bg-slate-100 text-slate-600 ring-slate-200",
    pending_confirmation: "bg-amber-50 text-amber-800 ring-amber-200",
    verification_delayed: "bg-amber-50 text-amber-800 ring-amber-200"
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${styles[status]}`}>
      {statusLabel(status)}
    </span>
  );
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
