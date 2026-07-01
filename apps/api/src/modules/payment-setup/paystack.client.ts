import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnprocessableEntityException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const DEFAULT_PAYSTACK_BASE_URL = "https://api.paystack.co";

export type PaystackBank = {
  active: boolean;
  code: string;
  country: string;
  currency: string;
  name: string;
};

export type PaystackResolvedAccount = {
  accountName: string;
  accountNumber: string;
  bankCode: string;
};

export type PaystackCreateSubaccountInput = {
  accountNumber: string;
  bankCode: string;
  businessName: string;
  primaryContactEmail: string;
  primaryContactName: string;
  primaryContactPhone?: string | null;
};

export type PaystackCreatedSubaccount = {
  active?: boolean;
  currency?: string | null;
  id?: number | string | null;
  isVerified?: boolean;
  settlementSchedule?: string | null;
  subaccountCode: string;
};

type PaystackBankData = {
  active?: boolean;
  code?: string;
  country?: string;
  currency?: string;
  name?: string;
};

type PaystackResolveAccountData = {
  account_name?: string;
  account_number?: string;
  bank_code?: string;
};

type PaystackCreateSubaccountData = {
  active?: boolean;
  currency?: string | null;
  id?: number | string | null;
  is_verified?: boolean;
  settlement_schedule?: string | null;
  subaccount_code?: string;
};

type PaystackEnvelope<TData> = {
  data?: TData;
  message?: string;
  status?: boolean;
};

type PaystackRequestOptions = RequestInit & {
  invalidInputMessage?: string;
  unavailableMessage?: string;
};

@Injectable()
export class PaystackClient {
  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {}

  async listBanks(): Promise<PaystackBank[]> {
    const params = new URLSearchParams({
      country: "nigeria",
      currency: "NGN",
      perPage: "100"
    });
    const data = await this.request<PaystackBankData[]>(`/bank?${params.toString()}`);

    return data
      .map((bank) => ({
        active: bank.active !== false,
        code: String(bank.code ?? "").trim(),
        country: bank.country?.trim() || "Nigeria",
        currency: bank.currency?.trim() || "NGN",
        name: bank.name?.trim() || ""
      }))
      .filter(
        (bank) =>
          bank.active &&
          bank.code.length > 0 &&
          bank.name.length > 0 &&
          bank.currency.toUpperCase() === "NGN" &&
          bank.country.toLowerCase() === "nigeria"
      );
  }

  async resolveAccountNumber(input: {
    accountNumber: string;
    bankCode: string;
  }): Promise<PaystackResolvedAccount> {
    const params = new URLSearchParams({
      account_number: input.accountNumber,
      bank_code: input.bankCode
    });
    const data = await this.request<PaystackResolveAccountData>(
      `/bank/resolve?${params.toString()}`,
      {
        invalidInputMessage:
          "Could not resolve this account number. Check the bank and account number."
      }
    );
    const accountName = data.account_name?.trim();
    const accountNumber = data.account_number?.trim();

    if (!accountName || !accountNumber) {
      throw new ServiceUnavailableException("Paystack could not resolve this account.");
    }

    return {
      accountName,
      accountNumber,
      bankCode: data.bank_code?.trim() || input.bankCode
    };
  }

  async createSubaccount(input: PaystackCreateSubaccountInput): Promise<PaystackCreatedSubaccount> {
    const body: Record<string, string | number> = {
      business_name: input.businessName,
      settlement_bank: input.bankCode,
      account_number: input.accountNumber,
      percentage_charge: 0,
      primary_contact_email: input.primaryContactEmail,
      primary_contact_name: input.primaryContactName
    };

    if (input.primaryContactPhone) {
      body.primary_contact_phone = input.primaryContactPhone;
    }

    const data = await this.request<PaystackCreateSubaccountData>("/subaccount", {
      body: JSON.stringify(body),
      method: "POST"
    });
    const subaccountCode = data.subaccount_code?.trim();

    if (!subaccountCode) {
      throw new ServiceUnavailableException("Paystack did not return a usable subaccount.");
    }

    return {
      subaccountCode,
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.id !== undefined ? { id: data.id } : {}),
      ...(data.is_verified !== undefined ? { isVerified: data.is_verified } : {}),
      ...(data.settlement_schedule !== undefined
        ? { settlementSchedule: data.settlement_schedule }
        : {})
    };
  }

  private async request<TData>(path: string, init: PaystackRequestOptions = {}): Promise<TData> {
    const { invalidInputMessage, unavailableMessage, ...requestInit } = init;
    const secretKey = this.configService.get<string>("PAYSTACK_SECRET_KEY");

    if (!secretKey) {
      throw new ServiceUnavailableException(
        "Payment provider is not configured. Add PAYSTACK_SECRET_KEY and try again."
      );
    }

    const headers = new Headers(requestInit.headers);
    headers.set("Authorization", `Bearer ${secretKey}`);
    headers.set("Content-Type", "application/json");

    let response: Response;

    try {
      const baseUrl =
        this.configService.get<string>("PAYSTACK_BASE_URL") ?? DEFAULT_PAYSTACK_BASE_URL;
      response = await fetch(new URL(path, baseUrl), {
        ...requestInit,
        headers
      });
    } catch {
      throw new ServiceUnavailableException(
        unavailableMessage ?? "Paystack is temporarily unavailable."
      );
    }

    let envelope: PaystackEnvelope<TData>;

    try {
      envelope = (await response.json()) as PaystackEnvelope<TData>;
    } catch {
      throw new ServiceUnavailableException(
        unavailableMessage ?? "Paystack is temporarily unavailable."
      );
    }

    if (!response.ok || envelope.status === false || envelope.data === undefined) {
      const providerMessage = this.safeProviderMessage(envelope.message);

      throw this.toPaystackException({
        invalidInputMessage,
        providerMessage,
        responseStatus: response.status,
        unavailableMessage
      });
    }

    return envelope.data;
  }

  private toPaystackException(input: {
    invalidInputMessage: string | undefined;
    providerMessage: string | null;
    responseStatus: number;
    unavailableMessage: string | undefined;
  }) {
    const { invalidInputMessage, providerMessage, responseStatus, unavailableMessage } = input;

    if (responseStatus === 401 || responseStatus === 403) {
      return new ServiceUnavailableException(
        "Payment provider authentication failed. Verify PAYSTACK_SECRET_KEY."
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
        providerMessage ?? invalidInputMessage ?? "Paystack could not validate this request."
      );
    }

    if (responseStatus === 409) {
      return new ConflictException(
        providerMessage ?? "This Paystack request conflicts with the current state."
      );
    }

    if (responseStatus >= 500) {
      return new ServiceUnavailableException(
        providerMessage ?? unavailableMessage ?? "Paystack is temporarily unavailable."
      );
    }

    if (providerMessage) {
      return new BadRequestException(providerMessage);
    }

    return new BadGatewayException(
      unavailableMessage ?? "Paystack request could not be completed."
    );
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
