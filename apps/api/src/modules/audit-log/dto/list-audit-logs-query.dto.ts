import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

import { auditLogCategories, type AuditLogCategory } from "../audit-log-presenter";

export class ListAuditLogsQueryDto {
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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
