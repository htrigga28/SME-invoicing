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
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { SendInvoiceEmailDto } from "../communications/dto/send-invoice-email.dto";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { InvoiceReasonDto } from "./dto/invoice-reason.dto";
import { ListInvoicesQueryDto } from "./dto/list-invoices-query.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { InvoicesService } from "./invoices.service";

@ApiTags("Invoices")
@ApiBearerAuth()
@Controller("invoices")
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles("owner", "admin", "accountant", "viewer")
  listInvoices(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListInvoicesQueryDto
  ) {
    return this.invoicesService.listInvoices(context, query);
  }

  @Post()
  @Roles("owner", "admin", "accountant")
  createInvoice(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: CreateInvoiceDto
  ) {
    return this.invoicesService.createInvoice(context, body);
  }

  @Get(":id/activity")
  @Roles("owner", "admin", "accountant", "viewer")
  getInvoiceActivity(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string
  ) {
    return this.invoicesService.getInvoiceActivity(context, id);
  }

  @Get(":id")
  @Roles("owner", "admin", "accountant", "viewer")
  getInvoice(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.invoicesService.getInvoice(context, id);
  }

  @Patch(":id")
  @Roles("owner", "admin", "accountant")
  updateInvoice(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: UpdateInvoiceDto
  ) {
    return this.invoicesService.updateInvoice(context, id, body);
  }

  @Post(":id/send")
  @Roles("owner", "admin", "accountant")
  sendInvoice(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: SendInvoiceEmailDto
  ) {
    return this.invoicesService.sendInvoice(context, id, body);
  }

  @Post(":id/resend")
  @Roles("owner", "admin", "accountant")
  resendInvoiceEmail(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: SendInvoiceEmailDto
  ) {
    return this.invoicesService.resendInvoiceEmail(context, id, body);
  }

  @Post(":id/delivery-attempts/:attemptId/retry")
  @Roles("owner", "admin", "accountant")
  @ApiOperation({
    summary: "Retry one unresolved delivery attempt with its original provider request"
  })
  retryUncertainDelivery(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Param("attemptId") attemptId: string
  ) {
    return this.invoicesService.retryUncertainDelivery(context, id, attemptId);
  }

  @Post(":id/duplicate")
  @Roles("owner", "admin", "accountant")
  duplicateInvoice(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string
  ) {
    return this.invoicesService.duplicateInvoice(context, id);
  }

  @Post(":id/cancel")
  @Roles("owner", "admin")
  cancelInvoice(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: InvoiceReasonDto
  ) {
    return this.invoicesService.cancelInvoice(context, id, body.reason);
  }

  @Post(":id/void")
  @Roles("owner", "admin")
  voidInvoice(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: InvoiceReasonDto
  ) {
    return this.invoicesService.voidInvoice(context, id, body.reason);
  }
}
