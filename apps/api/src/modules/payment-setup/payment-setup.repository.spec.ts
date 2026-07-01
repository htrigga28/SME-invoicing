import type { OrganisationPaymentAccount } from "../../database/schema";
import { PaymentSetupRepository } from "./payment-setup.repository";

const now = new Date("2026-06-30T10:00:00.000Z");

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
    accountName: "Demo Business",
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

describe("PaymentSetupRepository", () => {
  it("disables the previous active Paystack account before inserting the new one", async () => {
    const account = createPaymentAccount();
    const updateSet = jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) }));
    const returning = jest.fn().mockResolvedValue([account]);
    const insertValues = jest
      .fn()
      .mockImplementationOnce(() => ({ returning }))
      .mockImplementationOnce(() => Promise.resolve());
    const tx = {
      update: jest.fn(() => ({ set: updateSet })),
      insert: jest.fn(() => ({ values: insertValues }))
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new PaymentSetupRepository({ db } as never);

    const result = await repository.createPaymentAccount({
      organisationId: "org-1",
      now,
      account: {
        organisationId: "org-1",
        provider: "paystack",
        providerSubaccountCode: "ACCT_test",
        bankCode: "044",
        bankName: "Access Bank",
        accountName: "Demo Business",
        accountNumberLast4: "7890",
        status: "active",
        verifiedAt: now,
        disabledAt: null,
        createdByUserId: "user-1"
      },
      auditLogs: [
        {
          organisationId: "org-1",
          actorUserId: "user-1",
          action: "payment_account_created",
          entityType: "organisation_payment_account",
          metadataRedacted: { accountNumberLast4: "7890" }
        }
      ]
    });

    expect(result).toBe(account);
    expect(updateSet).toHaveBeenCalledWith({
      disabledAt: now,
      status: "disabled",
      updatedAt: now
    });
    expect(returning).toHaveBeenCalled();
    expect(insertValues).toHaveBeenLastCalledWith([
      expect.objectContaining({
        action: "payment_account_created",
        entityId: "payment-account-1"
      })
    ]);
  });

  it("disables active or delayed accounts and writes a safe audit log", async () => {
    const disabled = createPaymentAccount({
      status: "disabled",
      disabledAt: now
    });
    const returning = jest.fn().mockResolvedValue([disabled]);
    const updateWhere = jest.fn(() => ({ returning }));
    const updateSet = jest.fn(() => ({ where: updateWhere }));
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const tx = {
      update: jest.fn(() => ({ set: updateSet })),
      insert: jest.fn(() => ({ values: insertValues }))
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new PaymentSetupRepository({ db } as never);

    const result = await repository.disablePaymentAccount({
      organisationId: "org-1",
      actorUserId: "user-1",
      accountId: "payment-account-1",
      now,
      metadataRedacted: {
        accountNumberLast4: "7890",
        provider: "paystack",
        status: "disabled"
      }
    });

    expect(result).toBe(disabled);
    expect(updateSet).toHaveBeenCalledWith({
      disabledAt: now,
      status: "disabled",
      updatedAt: now
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_account_disabled",
        metadataRedacted: expect.not.objectContaining({ accountNumber: expect.any(String) })
      })
    );
  });

  it("reactivates a disabled account, clears disabled_at, disables other active accounts, and audits safely", async () => {
    const reactivated = createPaymentAccount({ status: "active", disabledAt: null });
    const otherActiveDisableWhere = jest.fn().mockResolvedValue(undefined);
    const reactivateReturning = jest.fn().mockResolvedValue([reactivated]);
    const reactivateWhere = jest.fn(() => ({ returning: reactivateReturning }));
    const updateSet = jest
      .fn()
      .mockImplementationOnce(() => ({ where: otherActiveDisableWhere }))
      .mockImplementationOnce(() => ({ where: reactivateWhere }));
    const insertValues = jest.fn().mockResolvedValue(undefined);
    const tx = {
      update: jest.fn(() => ({ set: updateSet })),
      insert: jest.fn(() => ({ values: insertValues }))
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const repository = new PaymentSetupRepository({ db } as never);

    const result = await repository.reactivatePaymentAccount({
      organisationId: "org-1",
      actorUserId: "user-1",
      accountId: "payment-account-1",
      now,
      metadataRedacted: {
        accountNumberLast4: "7890",
        provider: "paystack",
        status: "active"
      }
    });

    expect(result).toBe(reactivated);
    expect(updateSet).toHaveBeenNthCalledWith(1, {
      disabledAt: now,
      status: "disabled",
      updatedAt: now
    });
    expect(updateSet).toHaveBeenNthCalledWith(2, {
      disabledAt: null,
      status: "active",
      updatedAt: now
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "payment_account_reactivated",
        metadataRedacted: expect.not.objectContaining({ accountNumber: expect.any(String) })
      })
    );
  });
});
