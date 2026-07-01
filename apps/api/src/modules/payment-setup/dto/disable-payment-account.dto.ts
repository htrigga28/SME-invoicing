import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class DisablePaymentAccountDto {
  @ApiPropertyOptional({ example: "Switching payout account" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
