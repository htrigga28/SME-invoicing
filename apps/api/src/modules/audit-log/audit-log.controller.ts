import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { AuditLogService } from "./audit-log.service";
import { ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

@ApiTags("Audit logs")
@ApiBearerAuth()
@Controller("audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogsController {
  constructor(@Inject(AuditLogService) private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles("owner", "admin")
  @ApiOperation({ summary: "List organisation audit logs" })
  listAuditLogs(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListAuditLogsQueryDto
  ) {
    return this.auditLogService.listAuditLogs(context, query);
  }

  @Get(":id")
  @Roles("owner", "admin")
  @ApiOperation({ summary: "Get an organisation audit log" })
  getAuditLog(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.auditLogService.getAuditLog(context, id);
  }
}
