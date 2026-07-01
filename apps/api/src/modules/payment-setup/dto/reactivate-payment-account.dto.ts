import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReactivatePaymentAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
