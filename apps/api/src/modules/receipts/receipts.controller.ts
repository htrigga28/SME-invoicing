import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { ListReceiptsQueryDto } from "./dto/list-receipts-query.dto";
import { ReceiptsService } from "./receipts.service";

@ApiTags("Receipts")
@Controller("receipts")
export class ReceiptsController {
  constructor(@Inject(ReceiptsService) private readonly receiptsService: ReceiptsService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "List organisation receipts" })
  listReceipts(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListReceiptsQueryDto
  ) {
    return this.receiptsService.listReceipts(context, query);
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("owner", "admin", "accountant", "viewer")
  @ApiOperation({ summary: "Get an organisation receipt" })
  getReceipt(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.receiptsService.getReceipt(context, id);
  }
}

@ApiTags("Public receipts")
@Controller("public/receipts")
export class PublicReceiptsController {
  constructor(@Inject(ReceiptsService) private readonly receiptsService: ReceiptsService) {}

  @Get(":token")
  @ApiOperation({ summary: "Get a public receipt by token" })
  getPublicReceipt(@Param("token") token: string) {
    return this.receiptsService.getPublicReceipt(token);
  }
}
