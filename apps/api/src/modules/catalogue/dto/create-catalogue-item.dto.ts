import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

import { MAX_KOBO } from "../../../common/money-limits";

export class CreateCatalogueItemDto {
  @ApiProperty({ example: "Monthly bookkeeping" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: "Monthly bookkeeping and reconciliation support." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ example: 150000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  defaultUnitPriceKobo!: number;
}
