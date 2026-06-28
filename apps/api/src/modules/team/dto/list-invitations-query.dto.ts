import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class ListInvitationsQueryDto {
  @ApiPropertyOptional({ enum: ["pending", "accepted", "revoked", "expired"] })
  @IsOptional()
  @IsIn(["pending", "accepted", "revoked", "expired"])
  status?: "pending" | "accepted" | "revoked" | "expired";

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
