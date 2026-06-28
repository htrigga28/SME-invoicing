import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class ArchiveCustomerDto {
  @ApiPropertyOptional({ example: "Customer is no longer active." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
