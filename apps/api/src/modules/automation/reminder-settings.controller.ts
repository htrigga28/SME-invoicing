import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import type { ReminderPreferenceDto, ReminderStepDto, UpsertReminderSettingsDto } from "./dto/reminder-settings.dto";
import { ReminderSettingsService } from "./reminder-settings.service";
import { ScheduledSendService } from "./scheduled-send.service";
import type { ScheduleSendDto } from "./dto/reminder-settings.dto";

@ApiTags("Reminder settings")
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReminderSettingsController {
  constructor(
    @Inject(ReminderSettingsService) private readonly settings: ReminderSettingsService,
    @Inject(ScheduledSendService) private readonly scheduledSend: ScheduledSendService
  ) {}

  @Get("reminder-settings")
  @Roles("owner", "admin", "accountant", "viewer")
  get(@CurrentOrganisation() context: ActiveOrganisationContext) {
    return this.settings.getSettings(context.activeOrganisation.id);
  }

  @Post("reminder-settings")
  @Roles("owner", "admin")
  put(@CurrentOrganisation() context: ActiveOrganisationContext, @Body() body: UpsertReminderSettingsDto) {
    return this.settings.putSettings(context, body);
  }

  @Post("reminder-settings/steps")
  @Roles("owner", "admin")
  createStep(@CurrentOrganisation() context: ActiveOrganisationContext, @Body() body: ReminderStepDto) {
    return this.settings.createStep(context, body);
  }

  @Patch("reminder-settings/steps/:stepId")
  @Roles("owner", "admin")
  updateStep(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("stepId") stepId: string,
    @Body() body: Partial<ReminderStepDto>
  ) {
    return this.settings.updateStep(context, stepId, body);
  }

  @Delete("reminder-settings/steps/:stepId")
  @Roles("owner", "admin")
  deleteStep(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("stepId") stepId: string) {
    return this.settings.deleteStep(context, stepId);
  }

  @Patch("invoices/:id/reminder-preference")
  @Roles("owner", "admin", "accountant")
  setInvoicePreference(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: ReminderPreferenceDto
  ) {
    return this.settings.setInvoicePreference(context, id, body.automaticRemindersEnabled);
  }

  @Patch("customers/:id/reminder-preference")
  @Roles("owner", "admin", "accountant")
  setCustomerPreference(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: ReminderPreferenceDto
  ) {
    return this.settings.setCustomerPreference(context, id, body.automaticRemindersEnabled);
  }

  @Post("invoices/:id/schedule-send")
  @Roles("owner", "admin", "accountant")
  scheduleSend(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: ScheduleSendDto
  ) {
    return this.scheduledSend.scheduleSend(context, id, body);
  }

  @Patch("invoices/:id/schedule-send")
  @Roles("owner", "admin", "accountant")
  changeSchedule(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: ScheduleSendDto
  ) {
    return this.scheduledSend.scheduleSend(context, id, body);
  }

  @Delete("invoices/:id/schedule-send")
  @Roles("owner", "admin", "accountant")
  cancelSchedule(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.scheduledSend.cancelScheduledSend(context, id);
  }
}


