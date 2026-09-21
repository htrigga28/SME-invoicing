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

import { assertKoboAmount } from "../../common/money-limits";

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
  providerTransactionId: string | null;
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
    id?: unknown;
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
  amountKobo: number | null;
  currency: string | null;
  providerRefundId: string | null;
  providerTransactionId: string | null;
  status: string | null;
  transactionReference: string | null;
  merchantNote: string | null;
};

export type PaystackRefundResponse = {
  amountKobo: number;
  currency: string;
  merchantNote: string | null;
  providerRefundId: string | null;
  providerTransactionId: string | null;
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
      id?: unknown;
      reference?: unknown;
    };
    merchant_note?: unknown;
  };
};

type PaystackRefundApiResponse = {
  status: boolean;
  message?: unknown;
  data?:
    | {
        amount?: unknown;
        currency?: unknown;
        id?: unknown;
        merchant_note?: unknown;
        status?: unknown;
        transaction?: unknown;
      }
    | Array<{
        amount?: unknown;
        currency?: unknown;
        id?: unknown;
        merchant_note?: unknown;
        status?: unknown;
        transaction?: unknown;
      }>;
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
        signal: AbortSignal.timeout(15000),
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
          },
          signal: AbortSignal.timeout(15000)
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
      providerTransactionId: this.safeString(payload.data.id, 120),
      channel: this.safeString(payload.data.channel, 80),
      gatewayResponse: this.safeString(payload.data.gateway_response, 500)
    };
  }

  async createRefund(input: PaystackCreateRefundInput): Promise<PaystackCreateRefundResponse> {
    const secretKey = this.configService.get<string>("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException("Paystack is not configured.");
    }

    assertKoboAmount(input.amountKobo, "Refund amount", 1);

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
        signal: AbortSignal.timeout(15000),
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

    // Strict evidence: missing provider fields stay missing. Callers must
    // validate this response against the requested refund before applying it
    // to financial state; request values are never substituted here.
    return {
      providerRefundId: this.safeString(payload.data.id, 120),
      providerTransactionId: this.safeString(payload.data.transaction?.id, 120),
      status: this.safeString(payload.data.status, 80),
      amountKobo: this.strictKobo(payload.data.amount),
      currency: this.safeString(payload.data.currency, 3),
      transactionReference: this.safeString(payload.data.transaction?.reference, 120),
      merchantNote: this.safeString(payload.data.merchant_note, 240)
    };
  }

  async fetchRefund(providerRefundId: string): Promise<PaystackRefundResponse> {
    const [refund] = await this.getRefunds(`/refund/${encodeURIComponent(providerRefundId)}`);

    if (!refund) {
      throw new BadGatewayException("Paystack refund response was invalid.");
    }

    return refund;
  }

  async listRefunds(providerTransactionId: string): Promise<PaystackRefundResponse[]> {
    return this.getRefunds(`/refund?transaction=${encodeURIComponent(providerTransactionId)}`);
  }

  private async getRefunds(path: string): Promise<PaystackRefundResponse[]> {
    const secretKey = this.configService.get<string>("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException("Paystack is not configured.");
    }

    const baseUrl =
      this.configService.get<string>("PAYSTACK_BASE_URL") ?? "https://api.paystack.co";
    let response: Response;

    try {
      response = await fetch(new URL(path, baseUrl), {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      throw new ServiceUnavailableException(
        "Paystack is temporarily unavailable. Please try again later."
      );
    }

    let payload: PaystackRefundApiResponse | undefined;

    try {
      payload = (await response.json()) as PaystackRefundApiResponse;
    } catch {
      payload = undefined;
    }

    if (!response.ok || !payload?.status || !payload.data) {
      throw this.toPaystackException(response.status, this.safeProviderMessage(payload?.message));
    }

    const rows = Array.isArray(payload.data) ? payload.data : [payload.data];
    return rows.map((refund) => {
      const transaction = refund.transaction;

      return {
        amountKobo: this.numberValue(refund.amount),
        currency: this.safeString(refund.currency, 3) ?? "",
        merchantNote: this.safeString(refund.merchant_note, 240),
        providerRefundId: this.safeString(refund.id, 120),
        providerTransactionId: this.safeString(
          typeof transaction === "object" && transaction !== null && "id" in transaction
            ? transaction.id
            : transaction,
          120
        ),
        status: this.safeString(refund.status, 80) ?? "unknown",
        transactionReference: this.safeString(
          typeof transaction === "object" && transaction !== null && "reference" in transaction
            ? transaction.reference
            : null,
          120
        )
      };
    });
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

  /**
   * Strict kobo parsing for refund evidence: only a safe non-negative
   * integer counts. Anything else stays null so callers can distinguish
   * "Paystack returned zero" from "Paystack returned no usable amount".
   */
  private strictKobo(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      return null;
    }

    return parsed;
  }
}
