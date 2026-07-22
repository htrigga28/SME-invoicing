import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from "class-validator";

export class WaitlistUtmDto {
  @ApiPropertyOptional({ example: "google" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_source?: string | null;

  @ApiPropertyOptional({ example: "cpc" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_medium?: string | null;

  @ApiPropertyOptional({ example: "early-access" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_campaign?: string | null;

  @ApiPropertyOptional({ example: "hero" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_content?: string | null;

  @ApiPropertyOptional({ example: "invoice reconciliation nigeria" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  utm_term?: string | null;
}

export class CreateWaitlistEntryDto {
  @ApiProperty({ example: "founder@lagosagency.test" })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: "Ada Okonkwo" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fullName?: string | null;

  @ApiPropertyOptional({ example: "Lagos Bright Prints" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string | null;

  @ApiPropertyOptional({ example: "Founder / Owner" })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string | null;

  @ApiPropertyOptional({ example: "hero" })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string | null;

  @ApiPropertyOptional({ type: WaitlistUtmDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WaitlistUtmDto)
  utm?: WaitlistUtmDto | null;

  @ApiPropertyOptional({ example: "https://example.test/article" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  referrer?: string | null;

  @ApiPropertyOptional({ description: "Invisible honeypot field. Leave empty." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string | null;
}
