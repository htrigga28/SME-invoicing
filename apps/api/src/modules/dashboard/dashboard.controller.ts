import { Controller, Get, Inject, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { DashboardOverviewQueryDto } from "./dto/dashboard-overview-query.dto";
import { DashboardService } from "./dashboard.service";

@ApiTags("Dashboard")
@ApiBearerAuth()
@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get("overview")
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "Get organisation financial dashboard overview" })
  getOverview(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: DashboardOverviewQueryDto
  ) {
    return this.dashboardService.getOverview(context, query);
  }
}
