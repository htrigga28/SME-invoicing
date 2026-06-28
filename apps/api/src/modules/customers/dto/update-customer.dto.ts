import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: "Lagos Bright Prints" })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: "accounts@lagosbrightprints.test" })
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({ example: "+2348010000001", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({ example: "14 Allen Avenue, Ikeja, Lagos", nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  billingAddress?: string | null;
}
