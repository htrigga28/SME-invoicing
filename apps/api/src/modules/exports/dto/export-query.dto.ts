import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from "class-validator";

import { auditLogCategories, type AuditLogCategory } from "../../audit-log/audit-log-presenter";
import {
  paymentListStatuses,
  paymentListViews,
  reconciliationStates,
  type PaymentListView,
  type ReconciliationState
} from "../../payments/dto/list-payments-query.dto";
import {
  receiptRefundStates,
  type ReceiptRefundState
} from "../../receipts/dto/list-receipts-query.dto";

const customerStatuses = ["active", "archived", "all"] as const;
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

export class CustomerExportQueryDto {
  @ApiPropertyOptional({ example: "lagos" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: customerStatuses, default: "active" })
  @IsOptional()
  @IsIn(customerStatuses)
  status?: (typeof customerStatuses)[number];
}

export class InvoiceExportQueryDto {
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
}

export class PaymentExportQueryDto {
  @ApiPropertyOptional({ enum: paymentListViews, default: "reconciliation" })
  @IsOptional()
  @IsIn(paymentListViews)
  view?: PaymentListView;

  @ApiPropertyOptional({ example: "PAYSTACK_REF" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: paymentListStatuses, default: "all" })
  @IsOptional()
  @IsIn(paymentListStatuses)
  status?: (typeof paymentListStatuses)[number];

  @ApiPropertyOptional({ enum: reconciliationStates })
  @IsOptional()
  @IsIn(reconciliationStates)
  reconciliationState?: ReconciliationState;

  @ApiPropertyOptional({ example: "2026-06-01" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;
}

export class ReceiptExportQueryDto {
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
}

export class AuditLogExportQueryDto {
  @ApiPropertyOptional({ example: "invoice sent" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: "invoice_sent" })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ enum: auditLogCategories })
  @IsOptional()
  @IsIn(auditLogCategories)
  category?: AuditLogCategory;

  @ApiPropertyOptional({ example: "3f03c389-93f1-4f2a-9a7d-47ef8095ff55" })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ example: "invoice" })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ example: "2026-06-01" })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-06-30" })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
