import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { OrganisationPaymentAccount } from "../../database/schema";
import type { PaystackClient } from "./paystack.client";
import type { PaymentSetupRepository } from "./payment-setup.repository";
import { PaymentSetupService } from "./payment-setup.service";

const now = new Date("2026-06-30T10:00:00.000Z");
const fullAccountNumber = "1234567890";

function createContext(
  overrides: Partial<ActiveOrganisationContext> = {}
): ActiveOrganisationContext {
  return {
    user: {
      id: "user-1",
      email: "owner@demo.com",
      name: "Demo Owner",
      createdAt: now,
      updatedAt: now
    },
    activeOrganisation: {
      id: "org-1",
      name: "Demo Org",
      slug: "demo-org",
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now
    },
    membership: {
      id: "member-1",
      organisationId: "org-1",
      userId: "user-1",
      role: "owner",
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    businessProfile: {
      id: "profile-1",
      organisationId: "org-1",
      businessName: "Demo Business Ltd",
      email: "billing@demo.test",
      phone: "+2348012345678",
      address: "Lagos",
      logoFileId: null,
      setupCompletedAt: now,
      createdAt: now,
      updatedAt: now
    },
    ...overrides
  };
}

function createPaymentAccount(
  overrides: Partial<OrganisationPaymentAccount> = {}
): OrganisationPaymentAccount {
  return {
    id: "payment-account-1",
    organisationId: "org-1",
    provider: "paystack",
    providerSubaccountCode: "ACCT_test",
    bankCode: "044",
    bankName: "Access Bank",
    accountName: "Demo Business Ltd",
    accountNumberLast4: "7890",
    status: "active",
    verifiedAt: now,
    disabledAt: null,
    providerMetadataRedacted: { provider: "paystack" },
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createService() {
  const repository = {
    createAuditLog: jest.fn().mockResolvedValue(undefined),
    createPaymentAccount: jest.fn(async (input) => createPaymentAccount(input.account)),
    disablePaymentAccount: jest.fn(async () =>
      createPaymentAccount({ status: "disabled", disabledAt: now })
    ),
    findCurrentAccount: jest.fn().mockResolvedValue(null),
    findManageableAccount: jest.fn().mockResolvedValue(createPaymentAccount())
  } satisfies Partial<Record<keyof PaymentSetupRepository, jest.Mock>>;
  const paystackClient = {
    createSubaccount: jest.fn().mockResolvedValue({
      active: true,
      currency: "NGN",
      id: 123,
      isVerified: false,
      settlementSchedule: "auto",
      subaccountCode: "ACCT_test"
    }),
    listBanks: jest.fn().mockResolvedValue([
      {
        active: true,
        code: "044",
        country: "Nigeria",
        currency: "NGN",
        name: "Access Bank"
      }
    ]),
    resolveAccountNumber: jest.fn().mockResolvedValue({
      accountName: "Demo Business Ltd",
      accountNumber: fullAccountNumber,
      bankCode: "044"
    })
  } satisfies Partial<Record<keyof PaystackClient, jest.Mock>>;
  const service = new PaymentSetupService(
    repository as unknown as PaymentSetupRepository,
    paystackClient as unknown as PaystackClient
  );

  return { paystackClient, repository, service };
}

describe("PaymentSetupService", () => {
  it("returns not_configured when the organisation has no payment account", async () => {
    const { service } = createService();

    await expect(service.getAccount(createContext())).resolves.toEqual({
      status: "not_configured",
      paymentAccount: null
    });
  });

  it("returns safe payment account details without subaccount code or organisation id", async () => {
    const { repository, service } = createService();
    repository.findCurrentAccount.mockResolvedValueOnce(createPaymentAccount());

    const result = await service.getAccount(createContext());

    expect(result.paymentAccount).toEqual(
      expect.objectContaining({
        provider: "paystack",
        bankName: "Access Bank",
        accountNumberLast4: "7890"
      })
    );
    expect(result.paymentAccount).not.toHaveProperty("providerSubaccountCode");
    expect(result.paymentAccount).not.toHaveProperty("organisationId");
  });

  it("lists safe Nigerian NGN banks", async () => {
    const { service } = createService();

    await expect(service.listBanks()).resolves.toEqual({
      banks: [
        {
          active: true,
          code: "044",
          country: "Nigeria",
          currency: "NGN",
          name: "Access Bank"
        }
      ]
    });
  });

  it("resolves an account, returns only last4, and writes safe audit metadata", async () => {
    const { repository, service } = createService();

    const result = await service.resolveAccount(createContext(), {
      bankCode: "044",
      accountNumber: fullAccountNumber
    });

    expect(result).toEqual({
      bankCode: "044",
      bankName: "Access Bank",
      accountNumberLast4: "7890",
      accountName: "Demo Business Ltd"
    });
    expect(JSON.stringify(result)).not.toContain(fullAccountNumber);
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_account_resolved",
        metadataRedacted: expect.objectContaining({
          accountNumberLast4: "7890",
          accountName: "Demo Business Ltd"
        })
      })
    );
    expect(JSON.stringify(repository.createAuditLog.mock.calls)).not.toContain(fullAccountNumber);
  });

  it("returns a safe error and audit log when Paystack account resolution fails", async () => {
    const { paystackClient, repository, service } = createService();
    paystackClient.resolveAccountNumber.mockRejectedValueOnce(new Error("raw provider failure"));

    await expect(
      service.resolveAccount(createContext(), {
        bankCode: "044",
        accountNumber: fullAccountNumber
      })
    ).rejects.toMatchObject({
      message: "Could not resolve this account number. Check the bank and account number."
    });

    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_account_resolution_failed",
        metadataRedacted: expect.objectContaining({ accountNumberLast4: "7890" })
      })
    );
    expect(JSON.stringify(repository.createAuditLog.mock.calls)).not.toContain(fullAccountNumber);
  });

  it("preserves actionable provider throttling errors for account resolution", async () => {
    const { paystackClient, service } = createService();
    paystackClient.resolveAccountNumber.mockRejectedValueOnce(
      new HttpException(
        "Test mode daily limit of 3 live bank resolves exceeded. Use test bank codes 001 or upgrade to live mode.",
        HttpStatus.TOO_MANY_REQUESTS
      )
    );

    await expect(
      service.resolveAccount(createContext(), {
        bankCode: "044",
        accountNumber: fullAccountNumber
      })
    ).rejects.toMatchObject({
      message:
        "Test mode daily limit of 3 live bank resolves exceeded. Use test bank codes 001 or upgrade to live mode."
    });
  });

  it("re-resolves before creating a Paystack subaccount with business and contact fields", async () => {
    const { paystackClient, repository, service } = createService();

    await service.createSubaccount(createContext(), {
      bankCode: "044",
      accountNumber: fullAccountNumber,
      confirmedAccountName: "Demo Business Ltd"
    });

    expect(paystackClient.resolveAccountNumber).toHaveBeenCalledWith({
      bankCode: "044",
      accountNumber: fullAccountNumber
    });
    expect(paystackClient.createSubaccount).toHaveBeenCalledWith({
      accountNumber: fullAccountNumber,
      bankCode: "044",
      businessName: "Demo Business Ltd",
      primaryContactEmail: "billing@demo.test",
      primaryContactName: "Demo Owner",
      primaryContactPhone: "+2348012345678"
    });
    expect(repository.createPaymentAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          provider: "paystack",
          providerSubaccountCode: "ACCT_test",
          bankCode: "044",
          bankName: "Access Bank",
          accountName: "Demo Business Ltd",
          accountNumberLast4: "7890",
          status: "active"
        })
      })
    );
    expect(JSON.stringify(repository.createPaymentAccount.mock.calls)).not.toContain(
      fullAccountNumber
    );
  });

  it("rejects confirmed account-name mismatches before creating a subaccount", async () => {
    const { paystackClient, repository, service } = createService();

    await expect(
      service.createSubaccount(createContext(), {
        bankCode: "044",
        accountNumber: fullAccountNumber,
        confirmedAccountName: "Different Name Ltd"
      })
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    expect(paystackClient.createSubaccount).not.toHaveBeenCalled();
    expect(repository.createPaymentAccount).not.toHaveBeenCalled();
  });

  it("returns a safe configuration error when Paystack is not configured", async () => {
    const { paystackClient, service } = createService();
    paystackClient.listBanks.mockRejectedValueOnce(
      new ServiceUnavailableException(
        "Payment provider is not configured. Add PAYSTACK_SECRET_KEY and try again."
      )
    );

    await expect(service.listBanks()).rejects.toMatchObject({
      message: "Payment provider is not configured. Add PAYSTACK_SECRET_KEY and try again."
    });
  });

  it("stores verification_delayed when Paystack returns an inactive subaccount", async () => {
    const { paystackClient, repository, service } = createService();
    paystackClient.createSubaccount.mockResolvedValueOnce({
      active: false,
      subaccountCode: "ACCT_delayed"
    });

    await service.createSubaccount(createContext(), {
      bankCode: "044",
      accountNumber: fullAccountNumber,
      confirmedAccountName: "Demo Business Ltd"
    });

    expect(repository.createPaymentAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        account: expect.objectContaining({
          status: "verification_delayed",
          verifiedAt: null
        })
      })
    );
  });

  it("requires a completed business profile before creating a subaccount", async () => {
    const { paystackClient, service } = createService();
    const context = createContext({
      businessProfile: {
        ...createContext().businessProfile,
        businessName: null,
        setupCompletedAt: null
      }
    });

    await expect(
      service.createSubaccount(context, {
        bankCode: "044",
        accountNumber: fullAccountNumber,
        confirmedAccountName: "Demo Business Ltd"
      })
    ).rejects.toMatchObject({
      message: "Complete your business profile before activating payouts."
    });

    expect(paystackClient.createSubaccount).not.toHaveBeenCalled();
  });

  it("returns a safe activation error when Paystack subaccount creation fails", async () => {
    const { paystackClient, service } = createService();
    paystackClient.createSubaccount.mockRejectedValueOnce(new Error("raw provider payload"));

    await expect(
      service.createSubaccount(createContext(), {
        bankCode: "044",
        accountNumber: fullAccountNumber,
        confirmedAccountName: "Demo Business Ltd"
      })
    ).rejects.toMatchObject({
      message: "Could not activate payouts with Paystack. Please try again later."
    });
  });

  it("disables the current active or delayed account without calling Paystack", async () => {
    const { paystackClient, repository, service } = createService();

    const result = await service.disableAccount(createContext(), {
      reason: "Switching payout account"
    });

    expect(result.paymentAccount.status).toBe("disabled");
    expect(repository.disablePaymentAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "payment-account-1",
        organisationId: "org-1",
        metadataRedacted: expect.objectContaining({
          accountNumberLast4: "7890",
          reason: "Switching payout account",
          status: "disabled"
        })
      })
    );
    expect(paystackClient.createSubaccount).not.toHaveBeenCalled();
    expect(JSON.stringify(repository.disablePaymentAccount.mock.calls)).not.toContain(
      fullAccountNumber
    );
  });
});
