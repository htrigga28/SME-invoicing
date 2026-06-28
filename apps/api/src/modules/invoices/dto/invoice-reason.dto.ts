import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class InvoiceReasonDto {
  @ApiProperty({ example: "Customer requested cancellation before work started." })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
