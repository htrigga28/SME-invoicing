import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export class UpdateBusinessProfileDto {
  @ApiProperty({ example: "Akin & Co Creative Services" })
  @IsString()
  @MinLength(2)
  businessName!: string;

  @ApiProperty({ example: "hello@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "+2348012345678" })
  @IsString()
  @MinLength(5)
  phone!: string;

  @ApiProperty({ example: "12 Admiralty Way, Lekki, Lagos" })
  @IsString()
  @MinLength(5)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  logoFileId?: string;
}
