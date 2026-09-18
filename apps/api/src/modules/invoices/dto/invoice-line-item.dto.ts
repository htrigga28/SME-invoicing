import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsString, Max, MaxLength, Min } from "class-validator";

import { MAX_INVOICE_QUANTITY, MAX_KOBO } from "../../../common/money-limits";

export class InvoiceLineItemDto {
  @ApiProperty({ example: "Brand identity design" })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_INVOICE_QUANTITY)
  quantity!: number;

  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  unitPriceKobo!: number;
}
