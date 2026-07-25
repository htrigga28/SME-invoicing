import { BadRequestException } from "@nestjs/common";

import { PublicWaitlistService } from "./public-waitlist.service";

function createService() {
  const onConflictDoNothing = jest.fn().mockResolvedValue([]);
  const values = jest.fn(() => ({ onConflictDoNothing }));
  const insert = jest.fn(() => ({ values }));
  const service = new PublicWaitlistService({ db: { insert } } as never);

  return {
    insert,
    onConflictDoNothing,
    service,
    values
  };
}

describe("PublicWaitlistService", () => {
  it("creates a waitlist entry with normalized email", async () => {
    const { onConflictDoNothing, service, values } = createService();

    const result = await service.createEntry({
      email: " FOUNDER@LAGOSAGENCY.TEST ",
      source: "hero"
    });

    expect(result).toEqual({
      success: true,
      message: "You're on the list. We'll let you know when early access opens."
    });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "founder@lagosagency.test",
        emailNormalized: "founder@lagosagency.test",
        source: "hero"
      })
    );
    expect(onConflictDoNothing).toHaveBeenCalledWith({ target: expect.any(Object) });
  });

  it("returns generic success for duplicate-style insert conflicts", async () => {
    const { service } = createService();

    await expect(
      service.createEntry({
        email: "duplicate@example.test"
      })
    ).resolves.toEqual({
      success: true,
      message: "You're on the list. We'll let you know when early access opens."
    });
  });

  it("rejects invalid email addresses", async () => {
    const { service } = createService();

    await expect(service.createEntry({ email: "not-an-email" })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("ignores honeypot submissions without inserting", async () => {
    const { insert, service } = createService();

    const result = await service.createEntry({
      email: "bot@example.test",
      website: "https://spam.example"
    });

    expect(result.success).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });

  it("trims optional values and stores UTM fields", async () => {
    const { service, values } = createService();

    await service.createEntry({
      email: "ada@example.test",
      fullName: " Ada Okonkwo ",
      companyName: " Lagos Bright Prints ",
      role: " Founder / Owner ",
      source: " final_cta ",
      referrer: " https://example.test/story ",
      utm: {
        utm_source: " google ",
        utm_medium: " cpc ",
        utm_campaign: " early-access ",
        utm_content: " hero-copy ",
        utm_term: " paystack reconciliation "
      }
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Lagos Bright Prints",
        fullName: "Ada Okonkwo",
        referrer: "https://example.test/story",
        role: "Founder / Owner",
        source: "final_cta",
        utmCampaign: "early-access",
        utmContent: "hero-copy",
        utmMedium: "cpc",
        utmSource: "google",
        utmTerm: "paystack reconciliation"
      })
    );
  });

  it("does not return sensitive or internal fields", async () => {
    const { service } = createService();

    const result = await service.createEntry({
      email: "private@example.test"
    });

    expect(Object.keys(result)).toEqual(["success", "message"]);
  });
});
