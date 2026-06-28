import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ example: "lagos" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ["active", "archived", "all"], default: "active" })
  @IsOptional()
  @IsIn(["active", "archived", "all"])
  status?: "active" | "archived" | "all";

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
