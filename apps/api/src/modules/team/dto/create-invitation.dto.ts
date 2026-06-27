import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn } from "class-validator";

export class CreateInvitationDto {
  @ApiProperty({ example: "accountant@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ["admin", "accountant", "viewer"] })
  @IsIn(["admin", "accountant", "viewer"])
  role!: "admin" | "accountant" | "viewer";
}
