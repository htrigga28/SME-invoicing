import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator";

import { MAX_KOBO } from "../../../common/money-limits";

export class CreatePaymentRefundDto {
  @ApiProperty({ example: 170000 })
  @IsInt()
  @Min(1)
  @Max(MAX_KOBO)
  amountKobo!: number;

  @ApiProperty({ example: "Refund duplicate overpayment." })
  @IsString()
  @MaxLength(240)
  reason!: string;
}
