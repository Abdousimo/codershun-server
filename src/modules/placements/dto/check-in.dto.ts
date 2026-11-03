import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";
import { CheckinType } from "../../../generated/prisma/client";

export class CreateCheckInDto {
  @ApiProperty({ enum: CheckinType, default: CheckinType.talent_monthly })
  @IsEnum(CheckinType)
  @IsNotEmpty()
  type!: CheckinType;

  @ApiProperty({ description: "Rating score between 1 and 5", example: 4 })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  score!: number;

  @ApiPropertyOptional({ description: "Qualitative feedback or concerns" })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ description: "Period start date (ISO date, defaults to start of current month)" })
  @IsString()
  @IsOptional()
  periodStart?: string;
}

