import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class SendInvoiceEmailDto {
  @ApiPropertyOptional({ example: ["accounts@northstar.example"] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  to?: string[];

  @ApiPropertyOptional({ example: ["finance@northstar.example"] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  cc?: string[];

  @ApiPropertyOptional({ example: "Invoice INV-000184 from Adebayo Studio" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;
}

export class ResendInvoiceEmailDto extends SendInvoiceEmailDto {
  @ApiPropertyOptional({
    description:
      "Resend only: send another email even though a previous attempt is still unresolved. The forced attempt is audited with the superseded attempt id."
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
