import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsNumber, IsString, MaxLength, Min } from "class-validator";

export class InvoiceLineItemDto {
  @ApiProperty({ example: "Brand identity design" })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  quantity!: number;

  @ApiProperty({ example: 250000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceKobo!: number;
}
