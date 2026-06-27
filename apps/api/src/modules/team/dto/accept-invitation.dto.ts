import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsString, MinLength, ValidateIf } from "class-validator";

export class AcceptInvitationDto {
  @ApiProperty({ enum: ["existing", "new"] })
  @IsIn(["existing", "new"])
  mode!: "existing" | "new";

  @ApiPropertyOptional({ example: "Invited User" })
  @ValidateIf((body: AcceptInvitationDto) => body.mode === "new")
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: "DemoPass123!" })
  @ValidateIf((body: AcceptInvitationDto) => body.mode === "new")
  @IsString()
  @MinLength(8)
  password?: string;
}
