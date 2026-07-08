import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, Matches } from "class-validator";

export const dashboardGranularities = ["auto", "day", "week", "month"] as const;

export type DashboardGranularityInput = (typeof dashboardGranularities)[number];
export type DashboardResolvedGranularity = Exclude<DashboardGranularityInput, "auto">;

export class DashboardOverviewQueryDto {
  @ApiPropertyOptional({ example: "2026-07-01" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateFrom must use YYYY-MM-DD format." })
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-07-30" })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "dateTo must use YYYY-MM-DD format." })
  dateTo?: string;

  @ApiPropertyOptional({ enum: dashboardGranularities, default: "auto" })
  @IsOptional()
  @IsIn(dashboardGranularities)
  granularity?: DashboardGranularityInput;
}
