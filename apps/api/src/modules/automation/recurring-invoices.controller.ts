import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { CreateRecurringInvoiceDto, UpdateRecurringInvoiceDto } from "./dto/recurring-invoice.dto";
import { RecurringInvoicesService } from "./recurring-invoices.service";

@ApiTags("Recurring invoices")
@ApiBearerAuth()
@Controller("recurring-invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecurringInvoicesController {
  constructor(@Inject(RecurringInvoicesService) private readonly service: RecurringInvoicesService) {}

  @Get()
  @Roles("owner", "admin", "accountant", "viewer")
  list(@CurrentOrganisation() context: ActiveOrganisationContext, @Query("status") status?: string) {
    return this.service.listSchedules(context, status);
  }

  @Post()
  @Roles("owner", "admin", "accountant")
  create(@CurrentOrganisation() context: ActiveOrganisationContext, @Body() body: CreateRecurringInvoiceDto) {
    return this.service.createSchedule(context, body);
  }

  @Get(":id")
  @Roles("owner", "admin", "accountant", "viewer")
  get(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.service.getSchedule(context, id);
  }

  @Patch(":id")
  @Roles("owner", "admin", "accountant")
  update(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: UpdateRecurringInvoiceDto
  ) {
    return this.service.updateSchedule(context, id, body);
  }

  @Post(":id/pause")
  @Roles("owner", "admin", "accountant")
  pause(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.service.pauseSchedule(context, id);
  }

  @Post(":id/resume")
  @Roles("owner", "admin", "accountant")
  resume(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.service.resumeSchedule(context, id);
  }

  @Post(":id/cancel")
  @Roles("owner", "admin", "accountant")
  cancel(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.service.cancelSchedule(context, id);
  }
}



