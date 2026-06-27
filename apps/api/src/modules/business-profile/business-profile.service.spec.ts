import { BusinessProfileService } from "./business-profile.service";
import type { AuthRepository } from "../auth/auth.repository";
import type { ActiveOrganisationContext } from "../../common/types/request-context";

const now = new Date("2026-01-01T00:00:00.000Z");

const context = {
  user: {
    id: "user-1",
    email: "owner@example.com",
    name: "Owner",
    createdAt: now,
    updatedAt: now
  },
  activeOrganisation: {
    id: "org-1",
    name: "Workspace",
    slug: "workspace",
    onboardingCompletedAt: null,
    createdAt: now,
    updatedAt: now
  },
  membership: {
    id: "member-1",
    organisationId: "org-1",
    userId: "user-1",
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now
  },
  businessProfile: {
    id: "profile-1",
    organisationId: "org-1",
    businessName: null,
    email: null,
    phone: null,
    address: null,
    logoFileId: null,
    setupCompletedAt: null,
    createdAt: now,
    updatedAt: now
  }
} satisfies ActiveOrganisationContext;

describe("BusinessProfileService", () => {
  it("completes business profile and organisation onboarding", async () => {
    const repository = {
      updateBusinessProfile: jest.fn().mockResolvedValue({
        ...context.businessProfile,
        businessName: "Akin & Co",
        email: "hello@example.com",
        phone: "+2348012345678",
        address: "12 Admiralty Way",
        setupCompletedAt: now
      }),
      completeOrganisationOnboarding: jest.fn().mockResolvedValue({
        ...context.activeOrganisation,
        onboardingCompletedAt: now
      }),
      createAuditLog: jest.fn()
    };
    const service = new BusinessProfileService(repository as unknown as AuthRepository);

    const result = await service.updateCurrentBusinessProfile(context, {
      businessName: "Akin & Co",
      email: "HELLO@example.com",
      phone: "+2348012345678",
      address: "12 Admiralty Way"
    });

    expect(repository.updateBusinessProfile).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({
        businessName: "Akin & Co",
        email: "hello@example.com"
      })
    );
    expect(repository.completeOrganisationOnboarding).toHaveBeenCalledWith("org-1");
    expect(repository.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "business_profile_completed" })
    );
    expect(result.onboardingCompleted).toBe(true);
  });
});
