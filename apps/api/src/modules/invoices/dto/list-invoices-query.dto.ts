import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

const invoiceStatuses = [
  "draft",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "void"
] as const;

export class ListInvoicesQueryDto {
  @ApiPropertyOptional({ example: "INV-000001" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: invoiceStatuses })
  @IsOptional()
  @IsIn(invoiceStatuses)
  status?: (typeof invoiceStatuses)[number];

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: "2026-06-01" })
  @IsOptional()
  @IsDateString()
  issueDateFrom?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  issueDateTo?: string;

  @ApiPropertyOptional({ example: "2026-06-01" })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
