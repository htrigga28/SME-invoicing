import { Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { PaymentsService } from "../payments/payments.service";
import { InvoicesService } from "./invoices.service";

@ApiTags("Public invoices")
@Controller("public/invoices")
export class PublicInvoicesController {
  constructor(
    @Inject(InvoicesService) private readonly invoicesService: InvoicesService,
    @Inject(PaymentsService) private readonly paymentsService: PaymentsService
  ) {}

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

  @Post(":token/pay")
  @ApiOperation({ summary: "Initialize Paystack payment for a public invoice" })
  initializePublicInvoicePayment(@Param("token") token: string) {
    return this.invoicesService.initializePublicInvoicePayment(token);
  }

  @Post(":token/payments/:reference/verify")
  @ApiOperation({ summary: "Verify a returned Paystack payment for a public invoice" })
  verifyPublicInvoicePayment(@Param("token") token: string, @Param("reference") reference: string) {
    return this.paymentsService.verifyPublicInvoicePayment(token, reference);
  }
}
