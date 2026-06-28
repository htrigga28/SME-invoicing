import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

import { InvoiceLineItemDto } from "./invoice-line-item.dto";

export class CreateInvoiceDto {
  @ApiProperty({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: "2026-06-28" })
  @IsDateString()
  issueDate!: string;

  @ApiProperty({ example: "2026-07-12" })
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ example: "Payment due within 14 days." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountKobo?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  taxKobo?: number;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];
}
