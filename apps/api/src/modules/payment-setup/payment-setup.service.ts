import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { OrganisationPaymentAccount } from "../../database/schema";
import { CreatePaymentSubaccountDto } from "./dto/create-payment-subaccount.dto";
import { DisablePaymentAccountDto } from "./dto/disable-payment-account.dto";
import { ResolvePaymentAccountDto } from "./dto/resolve-payment-account.dto";
import {
  PaystackClient,
  type PaystackBank,
  type PaystackCreatedSubaccount,
  type PaystackResolvedAccount
} from "./paystack.client";
import { PaymentSetupRepository } from "./payment-setup.repository";

type SafePaymentAccount = {
  accountName: string;
  accountNumberLast4: string;
  bankName: string;
  createdAt: Date;
  disabledAt: Date | null;
  id: string;
  provider: string;
  status: OrganisationPaymentAccount["status"];
  updatedAt: Date;
  verifiedAt: Date | null;
};

type ResolveResult = {
  accountName: string;
  accountNumberLast4: string;
  bankCode: string;
  bankName: string;
};

@Injectable()
export class PaymentSetupService {
  constructor(
    @Inject(PaymentSetupRepository)
    private readonly paymentSetupRepository: PaymentSetupRepository,
    @Inject(PaystackClient) private readonly paystackClient: PaystackClient
  ) {}

  async getAccount(context: ActiveOrganisationContext) {
    const paymentAccount = await this.paymentSetupRepository.findCurrentAccount(
      context.activeOrganisation.id
    );

    if (!paymentAccount) {
      return {
        status: "not_configured" as const,
        paymentAccount: null
      };
    }

    return {
      status: paymentAccount.status,
      paymentAccount: this.toSafePaymentAccount(paymentAccount)
    };
  }

  async listBanks() {
    try {
      const banks = await this.paystackClient.listBanks();

      return {
        banks: banks.map((bank) => ({
          active: bank.active,
          code: bank.code,
          country: bank.country,
          currency: bank.currency,
          name: bank.name
        }))
      };
    } catch (error) {
      throw this.safePaystackError(
        error,
        "Unable to load banks from Paystack. Please try again later."
      );
    }
  }

  async resolveAccount(context: ActiveOrganisationContext, input: ResolvePaymentAccountDto) {
    const normalized = this.normalizeAccountInput(input);

    try {
      const bank = await this.requireSupportedBank(normalized.bankCode);
      const resolved = await this.paystackClient.resolveAccountNumber(normalized);
      const result = this.toResolveResult(bank, resolved, normalized.accountNumber);

      await this.paymentSetupRepository.createAuditLog({
        organisationId: context.activeOrganisation.id,
        actorUserId: context.user.id,
        action: "payment_account_resolved",
        entityType: "organisation_payment_account",
        metadataRedacted: this.auditMetadata(result)
      });

      return result;
    } catch (error) {
      await this.paymentSetupRepository.createAuditLog({
        organisationId: context.activeOrganisation.id,
        actorUserId: context.user.id,
        action: "payment_account_resolution_failed",
        entityType: "organisation_payment_account",
        metadataRedacted: {
          provider: "paystack",
          bankCode: normalized.bankCode,
          accountNumberLast4: this.last4(normalized.accountNumber)
        }
      });

      throw this.safePaystackError(
        error,
        "Could not resolve this account number. Check the bank and account number."
      );
    }
  }

  async createSubaccount(context: ActiveOrganisationContext, input: CreatePaymentSubaccountDto) {
    this.assertBusinessProfileReady(context);
    const normalized = this.normalizeSubaccountInput(input);
    const bank = await this.requireSupportedBank(normalized.bankCode);
    const resolved = await this.reResolveForActivation(
      {
        accountNumber: normalized.accountNumber,
        bankCode: normalized.bankCode
      },
      context
    );
    const result = this.toResolveResult(bank, resolved, normalized.accountNumber);

    if (
      this.normalizeName(result.accountName) !== this.normalizeName(normalized.confirmedAccountName)
    ) {
      throw new UnprocessableEntityException(
        "The confirmed account name does not match the resolved account name. Please resolve the account again."
      );
    }

    let subaccount: PaystackCreatedSubaccount;

    try {
      subaccount = await this.paystackClient.createSubaccount({
        accountNumber: normalized.accountNumber,
        bankCode: bank.code,
        businessName: context.businessProfile.businessName!.trim(),
        primaryContactEmail: (context.businessProfile.email ?? context.user.email).trim(),
        primaryContactName: context.user.name,
        primaryContactPhone: context.businessProfile.phone?.trim() || null
      });
    } catch (error) {
      await this.paymentSetupRepository.createAuditLog({
        organisationId: context.activeOrganisation.id,
        actorUserId: context.user.id,
        action: "payment_account_subaccount_creation_failed",
        entityType: "organisation_payment_account",
        metadataRedacted: this.auditMetadata(result)
      });

      throw this.safePaystackError(
        error,
        "Could not activate payouts with Paystack. Please try again later."
      );
    }

    const now = new Date();
    const status = this.statusFromSubaccount(subaccount);
    const account = await this.paymentSetupRepository.createPaymentAccount({
      organisationId: context.activeOrganisation.id,
      now,
      account: {
        organisationId: context.activeOrganisation.id,
        provider: "paystack",
        providerSubaccountCode: subaccount.subaccountCode,
        bankCode: bank.code,
        bankName: bank.name,
        accountName: result.accountName,
        accountNumberLast4: result.accountNumberLast4,
        status,
        verifiedAt: status === "active" ? now : null,
        disabledAt: null,
        providerMetadataRedacted: this.redactSubaccountMetadata(subaccount),
        createdByUserId: context.user.id,
        createdAt: now,
        updatedAt: now
      },
      auditLogs: [
        {
          organisationId: context.activeOrganisation.id,
          actorUserId: context.user.id,
          action: "payment_account_confirmed",
          entityType: "organisation_payment_account",
          metadataRedacted: this.auditMetadata(result)
        },
        {
          organisationId: context.activeOrganisation.id,
          actorUserId: context.user.id,
          action: "payment_account_created",
          entityType: "organisation_payment_account",
          metadataRedacted: {
            ...this.auditMetadata(result),
            status
          }
        },
        {
          organisationId: context.activeOrganisation.id,
          actorUserId: context.user.id,
          action:
            status === "active"
              ? "payment_account_activated"
              : "payment_account_verification_delayed",
          entityType: "organisation_payment_account",
          metadataRedacted: {
            ...this.auditMetadata(result),
            status
          }
        }
      ]
    });

    return { paymentAccount: this.toSafePaymentAccount(account) };
  }

  async disableAccount(context: ActiveOrganisationContext, input: DisablePaymentAccountDto) {
    const account = await this.paymentSetupRepository.findManageableAccount(
      context.activeOrganisation.id
    );

    if (!account) {
      throw new ConflictException("No active payment account was found.");
    }

    const disabled = await this.paymentSetupRepository.disablePaymentAccount({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      accountId: account.id,
      now: new Date(),
      metadataRedacted: {
        provider: account.provider,
        bankCode: account.bankCode,
        bankName: account.bankName,
        accountNumberLast4: account.accountNumberLast4,
        accountName: account.accountName,
        paymentAccountId: account.id,
        status: "disabled",
        reason: input.reason?.trim() || null
      }
    });

    return { paymentAccount: this.toSafePaymentAccount(disabled) };
  }

  private normalizeAccountInput(input: ResolvePaymentAccountDto) {
    const bankCode = input.bankCode.trim();
    const accountNumber = input.accountNumber.trim();

    if (!/^\d{10}$/.test(accountNumber)) {
      throw new BadRequestException("Account number must be a 10-digit Nigerian account number.");
    }

    if (!bankCode) {
      throw new BadRequestException("Bank code is required.");
    }

    return { bankCode, accountNumber };
  }

  private normalizeSubaccountInput(input: CreatePaymentSubaccountDto) {
    const normalized = this.normalizeAccountInput(input);
    const confirmedAccountName = input.confirmedAccountName.trim();

    if (!confirmedAccountName) {
      throw new BadRequestException("Confirmed account name is required.");
    }

    return { ...normalized, confirmedAccountName };
  }

  private assertBusinessProfileReady(context: ActiveOrganisationContext) {
    const profile = context.businessProfile;

    if (!profile.setupCompletedAt || !profile.businessName?.trim() || !profile.email?.trim()) {
      throw new UnprocessableEntityException(
        "Complete your business profile before activating payouts."
      );
    }
  }

  private async requireSupportedBank(bankCode: string): Promise<PaystackBank> {
    const banks = await this.paystackClient.listBanks();
    const bank = banks.find((candidate) => candidate.code === bankCode);

    if (!bank) {
      throw new BadRequestException("Selected bank is not supported for NGN payouts.");
    }

    return bank;
  }

  private async reResolveForActivation(
    input: { accountNumber: string; bankCode: string },
    context: ActiveOrganisationContext
  ): Promise<PaystackResolvedAccount> {
    try {
      return await this.paystackClient.resolveAccountNumber(input);
    } catch (error) {
      await this.paymentSetupRepository.createAuditLog({
        organisationId: context.activeOrganisation.id,
        actorUserId: context.user.id,
        action: "payment_account_resolution_failed",
        entityType: "organisation_payment_account",
        metadataRedacted: {
          provider: "paystack",
          bankCode: input.bankCode,
          accountNumberLast4: this.last4(input.accountNumber)
        }
      });

      throw this.safePaystackError(
        error,
        "Could not resolve this account number. Check the bank and account number."
      );
    }
  }

  private toResolveResult(
    bank: PaystackBank,
    resolved: PaystackResolvedAccount,
    submittedAccountNumber: string
  ): ResolveResult {
    return {
      bankCode: bank.code,
      bankName: bank.name,
      accountNumberLast4: this.last4(resolved.accountNumber || submittedAccountNumber),
      accountName: resolved.accountName
    };
  }

  private statusFromSubaccount(
    subaccount: PaystackCreatedSubaccount
  ): OrganisationPaymentAccount["status"] {
    if (!subaccount.subaccountCode || subaccount.active === false) {
      return "verification_delayed";
    }

    return "active";
  }

  private redactSubaccountMetadata(subaccount: PaystackCreatedSubaccount) {
    return {
      provider: "paystack",
      active: subaccount.active ?? null,
      currency: subaccount.currency ?? null,
      isVerified: subaccount.isVerified ?? null,
      paystackSubaccountId: subaccount.id ?? null,
      settlementSchedule: subaccount.settlementSchedule ?? null
    };
  }

  private auditMetadata(input: ResolveResult) {
    return {
      provider: "paystack",
      bankCode: input.bankCode,
      bankName: input.bankName,
      accountNumberLast4: input.accountNumberLast4,
      accountName: input.accountName
    };
  }

  private normalizeName(value: string) {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  }

  private last4(accountNumber: string) {
    return accountNumber.slice(-4);
  }

  private safePaystackError(error: unknown, message: string) {
    if (error instanceof HttpException) {
      return error;
    }

    return new ServiceUnavailableException(message);
  }

  private toSafePaymentAccount(account: OrganisationPaymentAccount): SafePaymentAccount {
    return {
      id: account.id,
      provider: account.provider,
      bankName: account.bankName,
      accountName: account.accountName,
      accountNumberLast4: account.accountNumberLast4,
      status: account.status,
      verifiedAt: account.verifiedAt,
      disabledAt: account.disabledAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt
    };
  }
}
