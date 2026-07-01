import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ResolvePaymentAccountDto {
  @ApiProperty({ example: "044" })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  bankCode!: string;

  @ApiProperty({ example: "0000000000" })
  @IsString()
  @Matches(/^\d{10}$/, { message: "Account number must be a 10-digit Nigerian account number." })
  accountNumber!: string;
}
