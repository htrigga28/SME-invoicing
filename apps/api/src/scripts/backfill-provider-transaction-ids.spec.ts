import type { PaystackVerifyResponse } from "../modules/paystack/paystack.service";
import {
  backfillProviderTransactionIds,
  type ProviderTransactionIdRepairCandidate,
  type ProviderTransactionIdRepairDeps,
  type ProviderTransactionIdRepairSummary
} from "./backfill-provider-transaction-ids";

const candidate: ProviderTransactionIdRepairCandidate = {
  amountKobo: 50000,
  currency: "NGN",
  id: "payment-1",
  providerReference: "SME-INV000011-4F3A90LX"
};

const demoCandidate: ProviderTransactionIdRepairCandidate = {
  ...candidate,
  id: "payment-demo-1",
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

function createSummary(
  overrides: Partial<ProviderTransactionIdRepairSummary> = {}
): ProviderTransactionIdRepairSummary {
  return {
    scanned: 0,
    genuineCandidates: 0,
    excludedDemo: 0,
    repaired: 0,
    skipped: 0,
    failed: 0,
    ...overrides
  };
}

async function runRepair(options: {
  candidates: ProviderTransactionIdRepairCandidate[];
  persist?: (paymentId: string, providerTransactionId: string) => Promise<boolean>;
  verifyTransaction?: (reference: string) => Promise<PaystackVerifyResponse>;
}) {
  const persist = jest.fn(options.persist ?? (async () => true));
  const verifyTransaction = jest.fn(options.verifyTransaction ?? (async () => createVerification()));

  const summary = await backfillProviderTransactionIds({
    listMissing: jest.fn(async () => options.candidates),
    log: jest.fn(),
    persist,
    verifyTransaction
  });

  return { persist, summary, verifyTransaction };
}

describe("backfillProviderTransactionIds", () => {
  it("repairs a row when exact Paystack evidence matches", async () => {
    const { persist, summary } = await runRepair({ candidates: [candidate] });

    expect(summary).toEqual(createSummary({ scanned: 1, genuineCandidates: 1, repaired: 1 }));
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("payment-1", "1004723697");
  });

  it("excludes deterministic synthetic/demo payments from verification", async () => {
    const { persist, summary, verifyTransaction } = await runRepair({
      candidates: [demoCandidate]
    });

    expect(summary).toEqual(createSummary({ scanned: 1, excludedDemo: 1 }));
    expect(verifyTransaction).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it("distinguishes demo data from genuine unresolved legacy payments", async () => {
    const { persist, summary, verifyTransaction } = await runRepair({
      candidates: [demoCandidate, candidate]
    });

    expect(summary).toEqual(
      createSummary({ scanned: 2, genuineCandidates: 1, excludedDemo: 1, repaired: 1 })
    );
    expect(verifyTransaction).toHaveBeenCalledTimes(1);
    expect(verifyTransaction).toHaveBeenCalledWith(candidate.providerReference);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith("payment-1", "1004723697");
  });

  const mismatchCases: Array<[string, Partial<PaystackVerifyResponse>]> = [
    ["the verified reference does not match exactly", { reference: "OTHER-REFERENCE" }],
    ["the verified amount does not match", { amountKobo: candidate.amountKobo + 1 }],
    ["the verified currency does not match", { currency: "USD" }],
    ["the Paystack status is failed", { status: "failed" }],
    ["the Paystack status is abandoned", { status: "abandoned" }],
    ["the Paystack status is pending", { status: "pending" }],
    ["Paystack returns no transaction ID", { providerTransactionId: null }]
  ];

  it.each(mismatchCases)("skips a row when %s", async (_name, overrides) => {
    const persist = jest.fn(async () => true);

    const { summary } = await runRepair({
      candidates: [candidate],
      persist,
      verifyTransaction: async () => createVerification(overrides)
    });

    expect(summary).toEqual(createSummary({ scanned: 1, genuineCandidates: 1, skipped: 1 }));
    expect(persist).not.toHaveBeenCalled();
  });

  it("skips a row that already has a provider transaction ID", async () => {
    const persist = jest.fn(async () => false);

    const { summary } = await runRepair({ candidates: [candidate], persist });

    expect(summary).toEqual(createSummary({ scanned: 1, genuineCandidates: 1, skipped: 1 }));
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("leaves the row unchanged when Paystack verification is unavailable", async () => {
    const persist = jest.fn(async () => true);

    const { summary } = await runRepair({
      candidates: [candidate],
      persist,
      verifyTransaction: async () => {
        throw new Error("Paystack is temporarily unavailable.");
      }
    });

    expect(summary).toEqual(createSummary({ scanned: 1, genuineCandidates: 1, failed: 1 }));
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
    const deps: ProviderTransactionIdRepairDeps = {
      listMissing: jest.fn(async () => (storedTransactionIds.has(candidate.id) ? [] : [candidate])),
      log: jest.fn(),
      persist,
      verifyTransaction: jest.fn(async () => createVerification())
    };

    const first = await backfillProviderTransactionIds(deps);
    const second = await backfillProviderTransactionIds(deps);

    expect(first).toEqual(createSummary({ scanned: 1, genuineCandidates: 1, repaired: 1 }));
    expect(second).toEqual(createSummary());
    expect(persist).toHaveBeenCalledTimes(1);
    expect(storedTransactionIds.get(candidate.id)).toBe("1004723697");
  });
});
