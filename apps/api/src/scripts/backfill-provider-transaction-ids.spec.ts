import type { PaystackVerifyResponse } from "../modules/paystack/paystack.service";
import {
  backfillProviderTransactionIds,
  type ProviderTransactionIdRepairCandidate
} from "./backfill-provider-transaction-ids";

const candidate: ProviderTransactionIdRepairCandidate = {
  amountKobo: 50000,
  currency: "NGN",
  id: "payment-1",
  providerReference: "PAYSTACK_DEMO_INV000011_SUCCESSFUL"
};

function createVerification(
  overrides: Partial<PaystackVerifyResponse> = {}
): PaystackVerifyResponse {
  return {
    amountKobo: candidate.amountKobo,
    channel: "card",
    currency: candidate.currency,
    gatewayResponse: "Successful",
    paidAt: "2026-08-08T20:56:43.475Z",
    providerTransactionId: "1004723697",
    reference: candidate.providerReference,
    status: "success",
    ...overrides
  };
}

describe("backfillProviderTransactionIds", () => {
  it("repairs a row when exact Paystack evidence matches", async () => {
    const persist = jest.fn(async () => true);

    const summary = await backfillProviderTransactionIds({
      listMissing: jest.fn(async () => [candidate]),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => createVerification())
    });

    expect(summary).toEqual({ scanned: 1, repaired: 1, skipped: 0, failed: 0 });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("payment-1", "1004723697");
  });

  it("skips a row when the verified reference does not match exactly", async () => {
    const persist = jest.fn(async () => true);

    const summary = await backfillProviderTransactionIds({
      listMissing: jest.fn(async () => [candidate]),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => createVerification({ reference: "OTHER-REFERENCE" }))
    });

    expect(summary).toEqual({ scanned: 1, repaired: 0, skipped: 1, failed: 0 });
    expect(persist).not.toHaveBeenCalled();
  });

  it("skips a row when the verified amount does not match", async () => {
    const persist = jest.fn(async () => true);

    const summary = await backfillProviderTransactionIds({
      listMissing: jest.fn(async () => [candidate]),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () =>
        createVerification({ amountKobo: candidate.amountKobo + 1 })
      )
    });

    expect(summary).toEqual({ scanned: 1, repaired: 0, skipped: 1, failed: 0 });
    expect(persist).not.toHaveBeenCalled();
  });

  it("skips a row when the verified currency does not match", async () => {
    const persist = jest.fn(async () => true);

    const summary = await backfillProviderTransactionIds({
      listMissing: jest.fn(async () => [candidate]),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => createVerification({ currency: "USD" }))
    });

    expect(summary).toEqual({ scanned: 1, repaired: 0, skipped: 1, failed: 0 });
    expect(persist).not.toHaveBeenCalled();
  });

  it.each(["failed", "abandoned", "pending"])(
    "skips a row when the Paystack status is %s",
    async (status) => {
      const persist = jest.fn(async () => true);

      const summary = await backfillProviderTransactionIds({
        listMissing: jest.fn(async () => [candidate]),
        log: jest.fn(),
        persist,
        verifyTransaction: jest.fn(async () => createVerification({ status }))
      });

      expect(summary).toEqual({ scanned: 1, repaired: 0, skipped: 1, failed: 0 });
      expect(persist).not.toHaveBeenCalled();
    }
  );

  it("skips a row when Paystack returns no transaction ID", async () => {
    const persist = jest.fn(async () => true);

    const summary = await backfillProviderTransactionIds({
      listMissing: jest.fn(async () => [candidate]),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => createVerification({ providerTransactionId: null }))
    });

    expect(summary).toEqual({ scanned: 1, repaired: 0, skipped: 1, failed: 0 });
    expect(persist).not.toHaveBeenCalled();
  });

  it("skips a row that already has a provider transaction ID", async () => {
    const persist = jest.fn(async () => false);

    const summary = await backfillProviderTransactionIds({
      listMissing: jest.fn(async () => [candidate]),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => createVerification())
    });

    expect(summary).toEqual({ scanned: 1, repaired: 0, skipped: 1, failed: 0 });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("leaves the row unchanged when Paystack verification is unavailable", async () => {
    const persist = jest.fn(async () => true);

    const summary = await backfillProviderTransactionIds({
      listMissing: jest.fn(async () => [candidate]),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => {
        throw new Error("Paystack is temporarily unavailable.");
      })
    });

    expect(summary).toEqual({ scanned: 1, repaired: 0, skipped: 0, failed: 1 });
    expect(persist).not.toHaveBeenCalled();
  });

  it("is safe to run repeatedly", async () => {
    const storedTransactionIds = new Map<string, string>();
    const persist = jest.fn(async (paymentId: string, providerTransactionId: string) => {
      if (storedTransactionIds.has(paymentId)) {
        return false;
      }

      storedTransactionIds.set(paymentId, providerTransactionId);
      return true;
    });
    const deps = {
      listMissing: jest.fn(async () =>
        storedTransactionIds.has(candidate.id) ? [] : [candidate]
      ),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => createVerification())
    };

    const first = await backfillProviderTransactionIds(deps);
    const second = await backfillProviderTransactionIds(deps);

    expect(first).toEqual({ scanned: 1, repaired: 1, skipped: 0, failed: 0 });
    expect(second).toEqual({ scanned: 0, repaired: 0, skipped: 0, failed: 0 });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(storedTransactionIds.get(candidate.id)).toBe("1004723697");
  });
});
