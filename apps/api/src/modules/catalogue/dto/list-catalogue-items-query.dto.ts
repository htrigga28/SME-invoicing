import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ListCatalogueItemsQueryDto {
  @ApiPropertyOptional({ example: "bookkeeping" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ["active", "archived", "all"], default: "active" })
  @IsOptional()
  @IsIn(["active", "archived", "all"])
  status?: "active" | "archived" | "all";
}
