import { PartialType } from "@nestjs/swagger";

import { CreateCatalogueItemDto } from "./create-catalogue-item.dto";

export class UpdateCatalogueItemDto extends PartialType(CreateCatalogueItemDto) {}
