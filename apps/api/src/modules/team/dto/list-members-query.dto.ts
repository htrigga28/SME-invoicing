import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class ListMembersQueryDto {
  @ApiPropertyOptional({ enum: ["active", "suspended", "removed"] })
  @IsOptional()
  @IsIn(["active", "suspended", "removed"])
  status?: "active" | "suspended" | "removed";

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
  limit?: number;
}
