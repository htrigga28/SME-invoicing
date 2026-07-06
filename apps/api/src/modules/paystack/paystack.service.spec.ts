import { ServiceUnavailableException, UnprocessableEntityException } from "@nestjs/common";

import { PaystackService } from "./paystack.service";

describe("PaystackService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("requires a configured secret key", async () => {
    const service = new PaystackService({ get: jest.fn().mockReturnValue(undefined) } as never);

    await expect(
      service.initializeTransaction({
        email: "accounts@example.com",
        amountKobo: 50000,
        bearer: "subaccount",
        currency: "NGN",
        reference: "SME-INV000001-ABC123",
        subaccount: "ACCT_test_subaccount",
        callbackUrl: "http://localhost:3000/invoice/token",
        metadata: {}
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("initializes a transaction against Paystack with the secret kept server-side", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: "https://checkout.paystack.test/pay/reference",
          access_code: "access-code",
          reference: "SME-INV000001-ABC123"
        }
      })
    } as never);
    const service = new PaystackService({
      get: jest.fn((key: string) =>
        key === "PAYSTACK_SECRET_KEY" ? "sk_test_secret" : "https://api.paystack.co"
      )
    } as never);

    await expect(
      service.initializeTransaction({
        email: "accounts@example.com",
        amountKobo: 50000,
        bearer: "subaccount",
        currency: "NGN",
        reference: "SME-INV000001-ABC123",
        subaccount: "ACCT_test_subaccount",
        callbackUrl: "http://localhost:3000/invoice/token",
        metadata: { invoiceId: "invoice-1" }
      })
    ).resolves.toEqual({
      authorizationUrl: "https://checkout.paystack.test/pay/reference",
      accessCode: "access-code",
      reference: "SME-INV000001-ABC123"
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.paystack.co/transaction/initialize");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer sk_test_secret",
        "Content-Type": "application/json"
      }
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      email: "accounts@example.com",
      amount: 50000,
      currency: "NGN",
      reference: "SME-INV000001-ABC123",
      subaccount: "ACCT_test_subaccount",
      bearer: "subaccount",
      callback_url: "http://localhost:3000/invoice/token",
      metadata: { invoiceId: "invoice-1" }
    });
  });

  it("preserves safe Paystack validation messages for initialization errors", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        status: false,
        message: "Invalid Email Address Passed"
      })
    } as never);
    const service = new PaystackService({
      get: jest.fn((key: string) =>
        key === "PAYSTACK_SECRET_KEY" ? "sk_test_secret" : "https://api.paystack.co"
      )
    } as never);

    const initialize = service.initializeTransaction({
      email: "accounts@example.com",
      amountKobo: 50000,
      bearer: "subaccount",
      currency: "NGN",
      reference: "SME-INV000001-ABC123",
      subaccount: "ACCT_test_subaccount",
      callbackUrl: "http://localhost:3000/invoice/token",
      metadata: {}
    });

    await expect(initialize).rejects.toMatchObject({
      message: "Invalid Email Address Passed"
    } satisfies Partial<UnprocessableEntityException>);
    await expect(initialize).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("does not expose Paystack authentication failure details", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({
        status: false,
        message: "Invalid key"
      })
    } as never);
    const service = new PaystackService({
      get: jest.fn((key: string) =>
        key === "PAYSTACK_SECRET_KEY" ? "sk_test_secret" : "https://api.paystack.co"
      )
    } as never);

    await expect(
      service.initializeTransaction({
        email: "accounts@example.com",
        amountKobo: 50000,
        bearer: "subaccount",
        currency: "NGN",
        reference: "SME-INV000001-ABC123",
        subaccount: "ACCT_test_subaccount",
        callbackUrl: "http://localhost:3000/invoice/token",
        metadata: {}
      })
    ).rejects.toThrow("Payment provider authentication failed. Please contact the business.");
  });

  it("verifies a transaction and returns normalized safe fields", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: true,
        message: "Verification successful",
        data: {
          reference: "SME-INV000001-ABC123",
          status: "success",
          amount: 50000,
          currency: "NGN",
          paid_at: "2026-06-30T10:00:00.000Z",
          channel: "card",
          gateway_response: "Successful",
          authorization: {
            authorization_code: "AUTH_secret"
          }
        }
      })
    } as never);
    const service = new PaystackService({
      get: jest.fn((key: string) =>
        key === "PAYSTACK_SECRET_KEY" ? "sk_test_secret" : "https://api.paystack.co"
      )
    } as never);

    await expect(service.verifyTransaction("SME-INV000001-ABC123")).resolves.toEqual({
      reference: "SME-INV000001-ABC123",
      status: "success",
      amountKobo: 50000,
      currency: "NGN",
      paidAt: "2026-06-30T10:00:00.000Z",
      channel: "card",
      gatewayResponse: "Successful"
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.paystack.co/transaction/verify/SME-INV000001-ABC123");
    expect(init).toMatchObject({
      method: "GET",
      headers: {
        Authorization: "Bearer sk_test_secret",
        "Content-Type": "application/json"
      }
    });
  });

  it("creates a refund with Paystack using a safe normalized payload", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        status: true,
        message: "Refund has been queued",
        data: {
          id: "refund-123",
          status: "pending",
          amount: 170000,
          currency: "NGN",
          transaction: {
            reference: "SME-INV000001-ABC123"
          },
          authorization: {
            authorization_code: "AUTH_secret"
          }
        }
      })
    } as never);
    const service = new PaystackService({
      get: jest.fn((key: string) =>
        key === "PAYSTACK_SECRET_KEY" ? "sk_test_secret" : "https://api.paystack.co"
      )
    } as never);

    await expect(
      service.createRefund({
        transactionReference: "SME-INV000001-ABC123",
        amountKobo: 170000,
        currency: "NGN",
        customerNote: "Duplicate payment",
        merchantNote: "Duplicate payment"
      })
    ).resolves.toEqual({
      providerRefundId: "refund-123",
      status: "pending",
      amountKobo: 170000,
      currency: "NGN",
      transactionReference: "SME-INV000001-ABC123"
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://api.paystack.co/refund");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer sk_test_secret",
        "Content-Type": "application/json"
      }
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      transaction: "SME-INV000001-ABC123",
      amount: 170000,
      currency: "NGN",
      customer_note: "Duplicate payment",
      merchant_note: "Duplicate payment"
    });
  });
});
