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
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

import { CurrentOrganisation } from "../../common/decorators/current-organisation.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { ActiveOrganisationContext } from "../../common/types/request-context";
import { ArchiveCustomerDto } from "./dto/archive-customer.dto";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { ListCustomersQueryDto } from "./dto/list-customers-query.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomersService } from "./customers.service";

@ApiTags("Customers")
@ApiBearerAuth()
@Controller("customers")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customersService: CustomersService) {}

  @Get()
  @Roles("owner", "admin", "accountant", "viewer")
  listCustomers(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListCustomersQueryDto
  ) {
    return this.customersService.listCustomers(context, query);
  }

  @Post()
  @Roles("owner", "admin", "accountant")
  createCustomer(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: CreateCustomerDto
  ) {
    return this.customersService.createCustomer(context, body);
  }

  @Get(":id")
  @Roles("owner", "admin", "accountant", "viewer")
  getCustomer(@CurrentOrganisation() context: ActiveOrganisationContext, @Param("id") id: string) {
    return this.customersService.getCustomer(context, id);
  }

  @Patch(":id")
  @Roles("owner", "admin", "accountant")
  updateCustomer(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: UpdateCustomerDto
  ) {
    return this.customersService.updateCustomer(context, id, body);
  }

  @Post(":id/archive")
  @Roles("owner", "admin", "accountant")
  archiveCustomer(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: ArchiveCustomerDto
  ) {
    return this.customersService.archiveCustomer(context, id, body);
  }
}
