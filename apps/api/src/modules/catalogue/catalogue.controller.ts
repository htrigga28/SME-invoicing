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
import { CatalogueService } from "./catalogue.service";
import { CreateCatalogueItemDto } from "./dto/create-catalogue-item.dto";
import { ListCatalogueItemsQueryDto } from "./dto/list-catalogue-items-query.dto";
import { UpdateCatalogueItemDto } from "./dto/update-catalogue-item.dto";

@ApiTags("Catalogue items")
@ApiBearerAuth()
@Controller("catalogue-items")
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogueController {
  constructor(@Inject(CatalogueService) private readonly catalogueService: CatalogueService) {}

  @Get()
  @Roles("owner", "admin", "accountant", "viewer")
  listCatalogueItems(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Query() query: ListCatalogueItemsQueryDto
  ) {
    return this.catalogueService.listCatalogueItems(context, query);
  }

  @Post()
  @Roles("owner", "admin", "accountant")
  createCatalogueItem(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Body() body: CreateCatalogueItemDto
  ) {
    return this.catalogueService.createCatalogueItem(context, body);
  }

  @Patch(":id")
  @Roles("owner", "admin", "accountant")
  updateCatalogueItem(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string,
    @Body() body: UpdateCatalogueItemDto
  ) {
    return this.catalogueService.updateCatalogueItem(context, id, body);
  }

  @Post(":id/archive")
  @Roles("owner", "admin", "accountant")
  archiveCatalogueItem(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string
  ) {
    return this.catalogueService.archiveCatalogueItem(context, id);
  }

  @Post(":id/restore")
  @Roles("owner", "admin", "accountant")
  restoreCatalogueItem(
    @CurrentOrganisation() context: ActiveOrganisationContext,
    @Param("id") id: string
  ) {
    return this.catalogueService.restoreCatalogueItem(context, id);
  }
}
