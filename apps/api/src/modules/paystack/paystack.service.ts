import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type PaystackInitializeInput = {
  amountKobo: number;
  bearer: "subaccount";
  callbackUrl: string;
  currency: "NGN";
  email: string;
  metadata: Record<string, unknown>;
  reference: string;
  subaccount: string;
};

type PaystackInitializeResponse = {
  accessCode: string;
  authorizationUrl: string;
  reference: string;
};

type PaystackInitializeApiResponse = {
  status: boolean;
  message?: unknown;
  data?: {
    access_code?: string;
    authorization_url?: string;
    reference?: string;
  };
};

export type PaystackVerifyResponse = {
  amountKobo: number;
  channel: string | null;
  currency: string;
  gatewayResponse: string | null;
  paidAt: string | null;
  reference: string;
  status: string;
};

type PaystackVerifyApiResponse = {
  status: boolean;
  message?: unknown;
  data?: {
    amount?: unknown;
    channel?: unknown;
    currency?: unknown;
    gateway_response?: unknown;
    paid_at?: unknown;
    reference?: unknown;
    status?: unknown;
  };
};

type PaystackCreateRefundInput = {
  amountKobo: number;
  currency: "NGN";
  customerNote?: string | null;
  merchantNote?: string | null;
  transactionReference: string;
};

export type PaystackCreateRefundResponse = {
  amountKobo: number;
  currency: string;
  providerRefundId: string | null;
  status: string;
  transactionReference: string | null;
};

type PaystackCreateRefundApiResponse = {
  status: boolean;
  message?: unknown;
  data?: {
    id?: unknown;
    amount?: unknown;
    currency?: unknown;
    status?: unknown;
    transaction?: {
      reference?: unknown;
    };
  };
};

@Injectable()
export class PaystackService {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async initializeTransaction(input: PaystackInitializeInput): Promise<PaystackInitializeResponse> {
    const secretKey = this.configService.get<string>("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException("Paystack is not configured.");
    }

    const baseUrl =
      this.configService.get<string>("PAYSTACK_BASE_URL") ?? "https://api.paystack.co";
    let response: Response;

    try {
      response = await fetch(new URL("/transaction/initialize", baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: input.email,
          amount: input.amountKobo,
          currency: input.currency,
          reference: input.reference,
          subaccount: input.subaccount,
          bearer: input.bearer,
          callback_url: input.callbackUrl,
          metadata: input.metadata
        })
      });
    } catch {
      throw new ServiceUnavailableException(
        "Paystack is temporarily unavailable. Please try again later."
      );
    }

    let payload: PaystackInitializeApiResponse | undefined;

    try {
      payload = (await response.json()) as PaystackInitializeApiResponse;
    } catch {
      payload = undefined;
    }

    if (
      !response.ok ||
      !payload?.status ||
      !payload.data?.authorization_url ||
      !payload.data.access_code ||
      !payload.data.reference
    ) {
      throw this.toPaystackException(response.status, this.safeProviderMessage(payload?.message));
    }

    return {
      authorizationUrl: payload.data.authorization_url,
      accessCode: payload.data.access_code,
      reference: payload.data.reference
    };
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    const secretKey = this.configService.get<string>("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException("Paystack is not configured.");
    }

    const baseUrl =
      this.configService.get<string>("PAYSTACK_BASE_URL") ?? "https://api.paystack.co";
    let response: Response;

    try {
      response = await fetch(
        new URL(`/transaction/verify/${encodeURIComponent(reference)}`, baseUrl),
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json"
          }
        }
      );
    } catch {
      throw new ServiceUnavailableException(
        "Paystack is temporarily unavailable. Please try again later."
      );
    }

    let payload: PaystackVerifyApiResponse | undefined;

    try {
      payload = (await response.json()) as PaystackVerifyApiResponse;
    } catch {
      payload = undefined;
    }

    if (!response.ok || !payload?.status || !payload.data?.reference || !payload.data.status) {
      throw this.toPaystackException(response.status, this.safeProviderMessage(payload?.message));
    }

    return {
      reference: this.safeString(payload.data.reference, 120) ?? reference,
      status: this.safeString(payload.data.status, 80) ?? "unknown",
      amountKobo: this.numberValue(payload.data.amount),
      currency: this.safeString(payload.data.currency, 3) ?? "",
      paidAt: this.safeString(payload.data.paid_at, 80),
      channel: this.safeString(payload.data.channel, 80),
      gatewayResponse: this.safeString(payload.data.gateway_response, 500)
    };
  }

  async createRefund(input: PaystackCreateRefundInput): Promise<PaystackCreateRefundResponse> {
    const secretKey = this.configService.get<string>("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException("Paystack is not configured.");
    }

    if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
      throw new BadRequestException("Refund amount must be a positive integer.");
    }

    const baseUrl =
      this.configService.get<string>("PAYSTACK_BASE_URL") ?? "https://api.paystack.co";
    let response: Response;

    try {
      response = await fetch(new URL("/refund", baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transaction: input.transactionReference,
          amount: input.amountKobo,
          currency: input.currency,
          ...(input.customerNote ? { customer_note: input.customerNote } : {}),
          ...(input.merchantNote ? { merchant_note: input.merchantNote } : {})
        })
      });
    } catch {
      throw new ServiceUnavailableException(
        "Paystack is temporarily unavailable. Please try again later."
      );
    }

    let payload: PaystackCreateRefundApiResponse | undefined;

    try {
      payload = (await response.json()) as PaystackCreateRefundApiResponse;
    } catch {
      payload = undefined;
    }

    if (!response.ok || !payload?.status || !payload.data?.status) {
      throw this.toPaystackException(response.status, this.safeProviderMessage(payload?.message));
    }

    return {
      providerRefundId: this.safeString(payload.data.id, 120),
      status: this.safeString(payload.data.status, 80) ?? "pending",
      amountKobo: this.numberValue(payload.data.amount),
      currency: this.safeString(payload.data.currency, 3) ?? input.currency,
      transactionReference:
        this.safeString(payload.data.transaction?.reference, 120) ?? input.transactionReference
    };
  }

  private toPaystackException(responseStatus: number, providerMessage: string | null) {
    if (responseStatus === 401 || responseStatus === 403) {
      return new ServiceUnavailableException(
        "Payment provider authentication failed. Please contact the business."
      );
    }

    if (responseStatus === 429) {
      return new HttpException(
        providerMessage ?? "Payment provider rate limit reached. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (responseStatus === 400 || responseStatus === 404 || responseStatus === 422) {
      return new UnprocessableEntityException(
        providerMessage ?? "Paystack could not validate this payment request."
      );
    }

    if (responseStatus === 409) {
      return new ConflictException(
        providerMessage ?? "This Paystack payment request conflicts with the current state."
      );
    }

    if (responseStatus >= 500) {
      return new ServiceUnavailableException(
        providerMessage ?? "Paystack is temporarily unavailable. Please try again later."
      );
    }

    if (providerMessage) {
      return new BadRequestException(providerMessage);
    }

    return new BadGatewayException("Paystack initialization failed.");
  }

  private safeProviderMessage(message: unknown) {
    if (typeof message !== "string") {
      return null;
    }

    const trimmed = message.trim();

    if (!trimmed || trimmed.length > 240) {
      return null;
    }

    if (/[{}[\]<>]/.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  private safeString(value: unknown, maxLength: number) {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }

    const normalized = String(value).trim();

    if (!normalized) {
      return null;
    }

    return normalized.slice(0, maxLength);
  }

  private numberValue(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
  }
}
