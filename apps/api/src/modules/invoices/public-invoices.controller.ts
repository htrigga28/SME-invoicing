import { Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { InvoicesService } from "./invoices.service";

@ApiTags("Public invoices")
@Controller("public/invoices")
export class PublicInvoicesController {
  constructor(@Inject(InvoicesService) private readonly invoicesService: InvoicesService) {}

  @Get(":token")
  @ApiOperation({ summary: "Get a customer-facing public invoice by token" })
  getPublicInvoice(@Param("token") token: string) {
    return this.invoicesService.getPublicInvoice(token);
  }

  @Post(":token/view")
  @ApiOperation({ summary: "Mark a public invoice as viewed" })
  markPublicInvoiceViewed(@Param("token") token: string) {
    return this.invoicesService.markPublicInvoiceViewed(token);
  }
}
