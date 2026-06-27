import { Body, Controller, Get, Inject, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { BusinessProfileService } from "./business-profile.service";
import { UpdateBusinessProfileDto } from "./dto/update-business-profile.dto";

@ApiTags("Business profile")
@ApiBearerAuth()
@Controller("business-profile")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BusinessProfileController {
  constructor(
    @Inject(BusinessProfileService) private readonly businessProfileService: BusinessProfileService
  ) {}

  @Get()
  @Roles("owner", "admin", "accountant", "viewer")
  getBusinessProfile(@CurrentOrganisation() context: ActiveOrganisationContext) {
    return this.businessProfileService.getCurrentBusinessProfile(context);
  }

  @Patch()
  @Roles("owner", "admin")
  updateBusinessProfile(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: UpdateBusinessProfileDto
  ) {
    return this.businessProfileService.updateCurrentBusinessProfile(context, body);
  }
}
