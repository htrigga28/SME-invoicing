import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { CreatePaymentSubaccountDto } from "./dto/create-payment-subaccount.dto";
import { DisablePaymentAccountDto } from "./dto/disable-payment-account.dto";
import { ResolvePaymentAccountDto } from "./dto/resolve-payment-account.dto";
import { PaymentSetupService } from "./payment-setup.service";

@ApiTags("Payment setup")
@ApiBearerAuth()
@Controller("payment-setup")
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentSetupController {
  constructor(
    @Inject(PaymentSetupService) private readonly paymentSetupService: PaymentSetupService
  ) {}

  @Get("account")
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "Get current organisation payment setup status" })
  getAccount(@CurrentOrganisation() context: ActiveOrganisationContext) {
    return this.paymentSetupService.getAccount(context);
  }

  @Get("banks")
  @Roles("owner", "admin")
  @ApiOperation({ summary: "List supported Nigerian NGN banks from Paystack" })
  listBanks() {
    return this.paymentSetupService.listBanks();
  }

  @Post("resolve-account")
  @Roles("owner", "admin")
  @ApiOperation({ summary: "Resolve and safely return a Nigerian bank account name" })
  resolveAccount(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: ResolvePaymentAccountDto
  ) {
    return this.paymentSetupService.resolveAccount(context, body);
  }

  @Post("subaccount")
  @Roles("owner", "admin")
  @ApiOperation({ summary: "Create and activate a Paystack subaccount for payouts" })
  createSubaccount(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: CreatePaymentSubaccountDto
  ) {
    return this.paymentSetupService.createSubaccount(context, body);
  }

  @Post("account/disable")
  @Roles("owner", "admin")
  @ApiOperation({ summary: "Disable the current Paystack payment account" })
  disableAccount(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: DisablePaymentAccountDto
  ) {
    return this.paymentSetupService.disableAccount(context, body);
  }
}
