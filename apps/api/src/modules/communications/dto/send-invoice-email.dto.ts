import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";

export class SendInvoiceEmailDto {
  @ApiProperty({ example: ["accounts@northstar.example"] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(320, { each: true })
  to!: string[];

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
