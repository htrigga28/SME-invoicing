import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MinLength } from "class-validator";

export class RefreshTokenDto {
  // Optional so cookie-based refresh can POST an empty body. The controller
  // still requires either the cookie or (during the compat window) this field.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
