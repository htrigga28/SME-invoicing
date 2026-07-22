import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { DatabaseService } from "../../database/database.service";
import { marketingWaitlistEntries } from "../../database/schema";
import type { CreateWaitlistEntryDto, WaitlistUtmDto } from "./dto/create-waitlist-entry.dto";

const WAITLIST_SUCCESS_MESSAGE = "You're on the list. We'll let you know when early access opens.";

export type WaitlistResponse = {
  success: true;
  message: typeof WAITLIST_SUCCESS_MESSAGE;
};

@Injectable()
export class PublicWaitlistService {
  constructor(@Inject(DatabaseService) private readonly databaseService: DatabaseService) {}

  async createEntry(input: CreateWaitlistEntryDto): Promise<WaitlistResponse> {
    if (this.optionalText(input.website, 500)) {
      return this.successResponse();
    }

    const emailNormalized = this.normalizeEmail(input.email);
    const utm = input.utm ?? {};

    await this.databaseService.db
      .insert(marketingWaitlistEntries)
      .values({
        email: emailNormalized,
        emailNormalized,
        fullName: this.optionalText(input.fullName, 200),
        companyName: this.optionalText(input.companyName, 200),
        role: this.optionalText(input.role, 120),
        source: this.optionalText(input.source, 80),
        utmSource: this.utmText(utm, "utm_source"),
        utmMedium: this.utmText(utm, "utm_medium"),
        utmCampaign: this.utmText(utm, "utm_campaign"),
        utmContent: this.utmText(utm, "utm_content"),
        utmTerm: this.utmText(utm, "utm_term"),
        referrer: this.optionalText(input.referrer, 2000)
      })
      .onConflictDoNothing({
        target: marketingWaitlistEntries.emailNormalized
      });

    return this.successResponse();
  }

  private successResponse(): WaitlistResponse {
    return {
      success: true,
      message: WAITLIST_SUCCESS_MESSAGE
    };
  }

  private normalizeEmail(email: unknown) {
    if (typeof email !== "string") {
      throw new BadRequestException("Enter a valid work email.");
    }

    const normalized = email.trim().toLowerCase();

    if (!normalized || normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException("Enter a valid work email.");
    }

    return normalized;
  }

  private optionalText(value: unknown, maxLength: number) {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value !== "string") {
      throw new BadRequestException("Optional waitlist fields must be strings.");
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    if (trimmed.length > maxLength) {
      throw new BadRequestException("One or more waitlist fields are too long.");
    }

    return trimmed;
  }

  private utmText(utm: WaitlistUtmDto, key: keyof WaitlistUtmDto) {
    return this.optionalText(utm[key], 200);
  }
}
