import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListPaymentEventsQueryDto {
  @ApiPropertyOptional({ example: "charge.success" })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) {
      return true;
    }

    if (value === "false" || value === false) {
      return false;
    }

    return value;
  })
  @IsBoolean()
  processed?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
