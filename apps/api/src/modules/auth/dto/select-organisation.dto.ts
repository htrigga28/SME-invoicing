import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class SelectOrganisationDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  organisationId!: string;
}
