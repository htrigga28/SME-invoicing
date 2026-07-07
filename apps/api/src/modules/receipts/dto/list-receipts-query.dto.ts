import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export const receiptRefundStates = ["none", "partially_refunded", "refunded", "all"] as const;

export type ReceiptRefundState = (typeof receiptRefundStates)[number];

export class ListReceiptsQueryDto {
  @ApiPropertyOptional({ example: "RCT-000001" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({ enum: receiptRefundStates, default: "all" })
  @IsOptional()
  @IsIn(receiptRefundStates)
  refundState?: ReceiptRefundState;

  @ApiPropertyOptional({ example: "2026-06-01" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

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
