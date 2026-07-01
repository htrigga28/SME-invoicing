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
}
