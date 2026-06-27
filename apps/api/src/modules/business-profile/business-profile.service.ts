import { Inject, Injectable } from "@nestjs/common";

import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { AuthRepository } from "../auth/auth.repository";

import { UpdateBusinessProfileDto } from "./dto/update-business-profile.dto";

@Injectable()
export class BusinessProfileService {
  constructor(@Inject(AuthRepository) private readonly authRepository: AuthRepository) {}

  getCurrentBusinessProfile(context: ActiveOrganisationContext) {
    return { businessProfile: context.businessProfile };
  }

  async updateCurrentBusinessProfile(
    context: ActiveOrganisationContext,
    input: UpdateBusinessProfileDto
  ) {
    const setupCompletedAt = new Date();
    const businessProfile = await this.authRepository.updateBusinessProfile(
      context.activeOrganisation.id,
      {
        businessName: input.businessName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        address: input.address.trim(),
        logoFileId: input.logoFileId ?? null,
        setupCompletedAt
      }
    );

    const onboardingWasAlreadyComplete =
      context.businessProfile.setupCompletedAt !== null &&
      context.activeOrganisation.onboardingCompletedAt !== null;

    const organisation = context.activeOrganisation.onboardingCompletedAt
      ? context.activeOrganisation
      : await this.authRepository.completeOrganisationOnboarding(context.activeOrganisation.id);

    await this.authRepository.createAuditLog({
      organisationId: context.activeOrganisation.id,
      actorUserId: context.user.id,
      action: onboardingWasAlreadyComplete
        ? "business_profile_updated"
        : "business_profile_completed",
      entityType: "business_profile",
      entityId: businessProfile.id,
      metadataRedacted: { onboardingCompleted: true }
    });

    return {
      businessProfile,
      activeOrganisation: organisation,
      onboardingCompleted: true
    };
  }
}
