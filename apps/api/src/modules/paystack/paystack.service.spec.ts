import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";

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

  it("maps failed provider responses to a safe gateway error", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
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
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
