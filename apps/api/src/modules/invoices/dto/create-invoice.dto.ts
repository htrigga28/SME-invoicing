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
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

import { MAX_KOBO } from "../../../common/money-limits";
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

  @ApiPropertyOptional({ example: "PO-2026-042" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerReference?: string | null;

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
  @Max(MAX_KOBO)
  discountKobo?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  taxKobo?: number;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems!: InvoiceLineItemDto[];
}
