import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { ListPaymentEventsQueryDto } from "./dto/list-payment-events-query.dto";
import { ListPaymentsQueryDto } from "./dto/list-payments-query.dto";
import { PaymentSummaryQueryDto } from "./dto/payment-summary-query.dto";
import { PaymentsService } from "./payments.service";

type RawBodyRequest = {
  rawBody?: Buffer;
};

@ApiTags("Payments")
@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "List organisation payments with reconciliation state" })
  listPayments(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListPaymentsQueryDto
  ) {
    return this.paymentsService.listPayments(context, query);
  }

  @Get("summary")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "Summarize organisation payments" })
  getPaymentSummary(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: PaymentSummaryQueryDto
  ) {
    return this.paymentsService.getPaymentSummary(context, query);
  }

  @Get("events/review")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "List payment events that need reconciliation review" })
  listReviewEvents(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListPaymentEventsQueryDto
  ) {
    return this.paymentsService.listReviewEvents(context, query);
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "Get payment reconciliation detail" })
  getPayment(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.paymentsService.getPayment(context, id);
  }

  @Post("paystack/webhook")
  @HttpCode(200)
  @ApiOperation({ summary: "Process Paystack webhook events" })
  processPaystackWebhook(
    @Req() request: RawBodyRequest,
    @Headers("x-paystack-signature") signatureHeader?: string | string[]
  ) {
    if (!request.rawBody) {
      throw new BadRequestException("Raw webhook body is unavailable.");
    }

    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    return this.paymentsService.processPaystackWebhook(request.rawBody, signature);
  }
}
