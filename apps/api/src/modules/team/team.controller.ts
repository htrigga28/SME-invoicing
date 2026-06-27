import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/guards/optional-jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type {
  ActiveOrganisationContext,
  AuthenticatedUser
} from "../../common/types/request-context";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { ListInvitationsQueryDto } from "./dto/list-invitations-query.dto";
import { ListMembersQueryDto } from "./dto/list-members-query.dto";
import { UpdateMemberDto } from "./dto/update-member.dto";
import { TeamService } from "./team.service";

@ApiTags("Team")
@ApiBearerAuth()
@Controller("team")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeamController {
  constructor(@Inject(TeamService) private readonly teamService: TeamService) {}

  @Post("invitations")
  @Roles("owner", "admin")
  createInvitation(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: CreateInvitationDto
  ) {
    return this.teamService.createInvitation(context, body);
  }

  @Get("invitations")
  @Roles("owner", "admin")
  listInvitations(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListInvitationsQueryDto
  ) {
    return this.teamService.listInvitations(context, query);
  }

  @Post("invitations/:id/revoke")
  @Roles("owner", "admin")
  revokeInvitation(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") invitationId: string
  ) {
    return this.teamService.revokeInvitation(context, invitationId);
  }

  @Get("members")
  @Roles("owner", "admin")
  listMembers(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListMembersQueryDto
  ) {
    return this.teamService.listMembers(context, query);
  }

  @Patch("members/:id")
  @Roles("owner", "admin")
  updateMember(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") membershipId: string,
    @Body() body: UpdateMemberDto
  ) {
    return this.teamService.updateMember(context, membershipId, body);
  }

  @Post("members/:id/remove")
  @Roles("owner", "admin")
  removeMember(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") membershipId: string
  ) {
    return this.teamService.removeMember(context, membershipId);
  }
}

@ApiTags("Invitations")
@Controller("invitations")
export class PublicInvitationsController {
  constructor(@Inject(TeamService) private readonly teamService: TeamService) {}

  @Get(":token")
  previewInvitation(@Param("token") token: string) {
    return this.teamService.previewInvitation(token);
  }

  @Post(":token/accept")
  @UseGuards(OptionalJwtAuthGuard)
  acceptInvitation(
    @Param("token") token: string,
    @Body() body: AcceptInvitationDto,
    @CurrentUser() user?: AuthenticatedUser
  ) {
    return this.teamService.acceptInvitation(token, body, user?.userId);
  }
}
