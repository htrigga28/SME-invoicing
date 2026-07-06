import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, MaxLength, Min } from "class-validator";

export class CreatePaymentRefundDto {
  @ApiProperty({ example: 170000 })
  @IsInt()
  @Min(1)
  amountKobo!: number;

  @ApiProperty({ example: "Refund duplicate overpayment." })
  @IsString()
  @MaxLength(240)
  reason!: string;
}
