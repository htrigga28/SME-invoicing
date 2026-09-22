import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
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

export class RecurringLineItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  catalogueItemId?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty()
  @Type(() => Number)
  quantity!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  unitPriceKobo!: number;
}

export class CreateRecurringInvoiceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: "2026-09-30" })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ enum: ["weekly", "monthly", "quarterly", "yearly"] })
  @IsIn(["weekly", "monthly", "quarterly", "yearly"])
  frequency!: "weekly" | "monthly" | "quarterly" | "yearly";

  @ApiPropertyOptional({ example: "2027-09-30" })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  dueTermsDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toRecipients?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccRecipients?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  emailSubject?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerReference?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  discountKobo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  taxKobo?: number;

  @ApiProperty({ type: [RecurringLineItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RecurringLineItemDto)
  lineItems!: RecurringLineItemDto[];
}

export class UpdateRecurringInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: ["weekly", "monthly", "quarterly", "yearly"] })
  @IsOptional()
  @IsIn(["weekly", "monthly", "quarterly", "yearly"])
  frequency?: "weekly" | "monthly" | "quarterly" | "yearly";

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  dueTermsDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toRecipients?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ccRecipients?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  emailSubject?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerReference?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  discountKobo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_KOBO)
  taxKobo?: number;

  @ApiPropertyOptional({ type: [RecurringLineItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecurringLineItemDto)
  lineItems?: RecurringLineItemDto[];
}
