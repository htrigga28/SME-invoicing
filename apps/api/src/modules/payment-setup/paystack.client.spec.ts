import {
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PaystackClient } from "./paystack.client";

describe("PaystackClient", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function createClient(secretKey = "sk_test_demo") {
    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === "PAYSTACK_SECRET_KEY") {
          return secretKey;
        }

        return undefined;
      })
    } as unknown as ConfigService;

    return new PaystackClient(configService);
  }

  it("preserves actionable Paystack test-mode limits for account resolution", async () => {
    const client = createClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: jest.fn().mockResolvedValue({
        status: false,
        message:
          "Test mode daily limit of 3 live bank resolves exceeded. Use test bank codes 001 or upgrade to live mode."
      })
    } as Partial<Response>);

    try {
      await client.resolveAccountNumber({
        accountNumber: "0432402863",
        bankCode: "035A"
      });
      throw new Error("Expected resolveAccountNumber to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).message).toBe(
        "Test mode daily limit of 3 live bank resolves exceeded. Use test bank codes 001 or upgrade to live mode."
      );
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it("preserves Paystack validation messages for invalid account details", async () => {
    const client = createClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        status: false,
        message: "Resolve Account Number params passed are invalid."
      })
    } as Partial<Response>);

    await expect(
      client.resolveAccountNumber({
        accountNumber: "1234567890",
        bankCode: "999"
      })
    ).rejects.toMatchObject({
      message: "Resolve Account Number params passed are invalid."
    } satisfies Partial<UnprocessableEntityException>);
  });

  it("returns a configuration error when the Paystack key is missing", async () => {
    const client = createClient("");

    await expect(client.listBanks()).rejects.toMatchObject({
      message: "Payment provider is not configured. Add PAYSTACK_SECRET_KEY and try again."
    } satisfies Partial<ServiceUnavailableException>);
  });

  it("translates provider auth failures into a backend configuration message", async () => {
    const client = createClient();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: jest.fn().mockResolvedValue({
        status: false,
        message: "Invalid key"
      })
    } as Partial<Response>);

    await expect(client.listBanks()).rejects.toMatchObject({
      message: "Payment provider authentication failed. Verify PAYSTACK_SECRET_KEY."
    } satisfies Partial<ServiceUnavailableException>);
  });
});
