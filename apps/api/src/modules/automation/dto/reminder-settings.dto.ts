import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from "class-validator";

export class ReminderStepDto {
  @ApiProperty({ example: -3 })
  @Type(() => Number)
  @IsInt()
  @Min(-30)
  @Max(60)
  relativeDays!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  subjectTemplate!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  bodyTemplate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpsertReminderSettingsDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ type: [ReminderStepDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReminderStepDto)
  steps?: ReminderStepDto[];
}

export class ReminderPreferenceDto {
  @ApiProperty()
  @IsBoolean()
  automaticRemindersEnabled!: boolean;
}

export class ScheduleSendDto {
  @ApiProperty({ example: "2026-09-30" })
  @IsString()
  scheduledSendDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  to?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cc?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  subject?: string | null;
}
