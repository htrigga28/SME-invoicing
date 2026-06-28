import {
  BadGatewayException,
  Inject,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type PaystackInitializeInput = {
  amountKobo: number;
  callbackUrl: string;
  currency: "NGN";
  email: string;
  metadata: Record<string, unknown>;
  reference: string;
};

type PaystackInitializeResponse = {
  accessCode: string;
  authorizationUrl: string;
  reference: string;
};

type PaystackInitializeApiResponse = {
  status: boolean;
  message: string;
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
    const response = await fetch(new URL("/transaction/initialize", baseUrl), {
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
        callback_url: input.callbackUrl,
        metadata: input.metadata
      })
    });

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
      throw new BadGatewayException("Paystack initialization failed.");
    }

    return {
      authorizationUrl: payload.data.authorization_url,
      accessCode: payload.data.access_code,
      reference: payload.data.reference
    };
  }
}
