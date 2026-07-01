import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreatePaymentSubaccountDto {
  @ApiProperty({ example: "044" })
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  bankCode!: string;

  @ApiProperty({ example: "0000000000" })
  @IsString()
  @Matches(/^\d{10}$/, { message: "Account number must be a 10-digit Nigerian account number." })
  accountNumber!: string;

  @ApiProperty({ example: "Acme Studio Ltd" })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  confirmedAccountName!: string;
}
