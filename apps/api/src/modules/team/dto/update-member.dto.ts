import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";

export class UpdateMemberDto {
  @ApiPropertyOptional({ enum: ["admin", "accountant", "viewer"] })
  @IsOptional()
  @IsIn(["admin", "accountant", "viewer"])
  role?: "admin" | "accountant" | "viewer";

  @ApiPropertyOptional({ enum: ["active", "suspended"] })
  @IsOptional()
  @IsIn(["active", "suspended"])
  status?: "active" | "suspended";
}
