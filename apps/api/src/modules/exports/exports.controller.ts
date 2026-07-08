import { Controller, Get, Inject, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import {
  AuditLogExportQueryDto,
  CustomerExportQueryDto,
  InvoiceExportQueryDto,
  PaymentExportQueryDto,
  ReceiptExportQueryDto
} from "./dto/export-query.dto";
import { ExportsService } from "./exports.service";

type CsvResponse = {
  send: (body: string) => void;
  setHeader: (name: string, value: string) => void;
};

@ApiTags("Exports")
@ApiBearerAuth()
@Controller("exports")
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportsController {
  constructor(@Inject(ExportsService) private readonly exportsService: ExportsService) {}

  @Get("customers.csv")
  @Roles("owner", "admin", "accountant")
  @ApiOperation({ summary: "Export organisation customers as CSV" })
  async exportCustomers(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: CustomerExportQueryDto,
    @Res() response: CsvResponse
  ) {
    this.sendCsv(response, await this.exportsService.exportCustomers(context, query));
  }

  @Get("invoices.csv")
  @Roles("owner", "admin", "accountant")
  @ApiOperation({ summary: "Export organisation invoices as CSV" })
  async exportInvoices(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: InvoiceExportQueryDto,
    @Res() response: CsvResponse
  ) {
    this.sendCsv(response, await this.exportsService.exportInvoices(context, query));
  }

  @Get("payments.csv")
  @Roles("owner", "admin", "accountant")
  @ApiOperation({ summary: "Export organisation payments as CSV" })
  async exportPayments(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: PaymentExportQueryDto,
    @Res() response: CsvResponse
  ) {
    this.sendCsv(response, await this.exportsService.exportPayments(context, query));
  }

  @Get("receipts.csv")
  @Roles("owner", "admin", "accountant")
  @ApiOperation({ summary: "Export organisation receipts as CSV" })
  async exportReceipts(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ReceiptExportQueryDto,
    @Res() response: CsvResponse
  ) {
    this.sendCsv(response, await this.exportsService.exportReceipts(context, query));
  }

  @Get("audit-logs.csv")
  @Roles("owner", "admin")
  @ApiOperation({ summary: "Export organisation audit logs as CSV" })
  async exportAuditLogs(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: AuditLogExportQueryDto,
    @Res() response: CsvResponse
  ) {
    this.sendCsv(response, await this.exportsService.exportAuditLogs(context, query));
  }

  private sendCsv(response: CsvResponse, result: { content: string; filename: string }) {
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    response.send(result.content);
  }
}
