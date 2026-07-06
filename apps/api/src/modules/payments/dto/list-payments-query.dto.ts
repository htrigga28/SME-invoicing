import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export const paymentListStatuses = [
  "pending",
  "successful",
  "failed",
  "abandoned",
  "refunded",
  "all"
] as const;

export const reconciliationStates = [
  "matched",
  "pending_confirmation",
  "stale_pending",
  "failed",
  "abandoned",
  "refunded",
  "superseded",
  "review_required",
  "unknown"
] as const;

export type ReconciliationState = (typeof reconciliationStates)[number];

export const paymentListViews = ["reconciliation", "all_attempts", "review_required"] as const;

export type PaymentListView = (typeof paymentListViews)[number];

export const attemptStates = [
  "successful",
  "active_pending",
  "stale_pending",
  "failed_attempt",
  "abandoned_attempt",
  "refunded_attempt",
  "superseded",
  "review_required",
  "unknown"
] as const;

export type AttemptState = (typeof attemptStates)[number];

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ enum: paymentListViews, default: "reconciliation" })
  @IsOptional()
  @IsIn(paymentListViews)
  view?: PaymentListView;

  @ApiPropertyOptional({ example: "PAYSTACK_DEMO_INV_000012" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: paymentListStatuses, default: "all" })
  @IsOptional()
  @IsIn(paymentListStatuses)
  status?: (typeof paymentListStatuses)[number];

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiPropertyOptional({ enum: reconciliationStates })
  @IsOptional()
  @IsIn(reconciliationStates)
  reconciliationState?: (typeof reconciliationStates)[number];

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
