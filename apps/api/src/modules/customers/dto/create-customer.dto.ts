import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCustomerDto {
  @ApiProperty({ example: "Lagos Bright Prints" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: "accounts@lagosbrightprints.test" })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiPropertyOptional({ example: "+2348010000001" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;

  @ApiPropertyOptional({ example: "14 Allen Avenue, Ikeja, Lagos" })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  billingAddress?: string | null;
}
