import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";

import { EmailIdempotencyConflictError, EmailUncertainError } from "./email-provider";
import { ResendEmailProvider } from "./resend-email.provider";

jest.mock("resend", () => ({ Resend: jest.fn() }));

const mockSend = jest.fn();

function setup(config: Record<string, string | number | undefined> = {}) {
  mockSend.mockReset();
  (Resend as unknown as jest.Mock).mockReset().mockReturnValue({ emails: { send: mockSend } });
  const configService = {
    get: jest.fn((key: string) =>
      key === "RESEND_API_KEY"
        ? "re_test_key"
        : key === "RESEND_FROM_EMAIL"
          ? "billing@lumina.example"
          : config[key]
    )
  };
  return new ResendEmailProvider(configService as unknown as ConfigService);
}

const baseInput = {
  fromEmail: "billing@lumina.example",
  fromName: "Adebayo Studio via Lumina",
  replyToEmail: "billing@adebayo.example",
  to: [{ email: "accounts@northstar.example", name: "Northstar Projects" }],
  cc: [],
  subject: "Invoice INV-000184 from Adebayo Studio",
  htmlContent: "<p>Invoice</p>",
  textContent: "Invoice",
  tags: ["invoice_delivery", "INV-000184"],
  correlationId: "comm-1",
  idempotencyKey: "key-1"
};

describe("ResendEmailProvider", () => {
  it("sends through the SDK with idempotency key and correlation tags", async () => {
    const provider = setup();
    mockSend.mockResolvedValue({ data: { id: "email-id-1" }, error: null });

    const result = await provider.sendEmail(baseInput);

    expect(result).toEqual({ providerMessageId: "email-id-1" });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["Northstar Projects <accounts@northstar.example>"],
        tags: [
          { name: "invoice_delivery", value: "invoice_delivery" },
          { name: "lumina_communication", value: "comm-1" }
        ]
      }),
      { idempotencyKey: "key-1" }
    );
  });

  it("treats concurrent idempotent requests as retryable uncertainty", async () => {
    const provider = setup();
    mockSend.mockResolvedValue({
      data: null,
      error: {
        statusCode: 409,
        name: "concurrent_idempotent_requests",
        message: "already processing"
      }
    });

    await expect(provider.sendEmail(baseInput)).rejects.toBeInstanceOf(EmailUncertainError);
  });

  it("surfaces invalid idempotent requests as invariant conflicts", async () => {
    const provider = setup();
    mockSend.mockResolvedValue({
      data: null,
      error: {
        statusCode: 409,
        name: "invalid_idempotent_request",
        message: "payload differs"
      }
    });

    await expect(provider.sendEmail(baseInput)).rejects.toBeInstanceOf(
      EmailIdempotencyConflictError
    );
  });

  it("treats server errors as uncertain and rejections as definite failures", async () => {
    const provider = setup();
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 503, name: "internal_server_error", message: "down" }
    });
    await expect(provider.sendEmail(baseInput)).rejects.toBeInstanceOf(EmailUncertainError);

    mockSend.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 400, name: "validation_error", message: "bad" }
    });
    await expect(provider.sendEmail(baseInput)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it("treats timeouts as uncertain", async () => {
    const provider = setup({ RESEND_REQUEST_TIMEOUT_MS: 1000 });
    mockSend.mockReturnValue(new Promise(() => undefined));

    await expect(provider.sendEmail(baseInput)).rejects.toBeInstanceOf(EmailUncertainError);
  }, 10000);

  it("fails closed without an API key", async () => {
    const provider = setup();
    (provider as unknown as { configService: { get: jest.Mock } }).configService.get.mockReturnValue(
      undefined
    );

    await expect(provider.sendEmail(baseInput)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(mockSend).not.toHaveBeenCalled();
  });
});
