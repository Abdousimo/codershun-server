import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

import { SeniorityLevel } from "../../../generated/prisma/client";

export class CalculatePricingDto {
  @ApiPropertyOptional({ enum: SeniorityLevel, example: SeniorityLevel.mid })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ description: "Specific rate card version ID. If omitted, uses current active version." })
  @IsOptional()
  @IsUUID()
  rateCardVersionId?: string;

  @ApiPropertyOptional({ example: "1200.00", description: "Override base talent monthly pay in EUR" })
  @IsOptional()
  @IsNumberString()
  talentNetPay?: string;

  @ApiPropertyOptional({ example: "40.00", description: "Override target margin percentage (e.g. 40 for 40%)" })
  @IsOptional()
  @IsNumberString()
  targetMarginPct?: string;

  @ApiPropertyOptional({ example: "2000.00", description: "Manual client monthly price override" })
  @IsOptional()
  @IsNumberString()
  overrideClientPrice?: string;

  @ApiPropertyOptional({ example: "15.00", description: "Skill premium percentage for rare skills (e.g. 15)" })
  @IsOptional()
  @IsNumberString()
  skillPremiumPct?: string;

  @ApiPropertyOptional({ default: false, description: "Whether this is a 50% part-time placement" })
  @IsOptional()
  @IsBoolean()
  isPartTime?: boolean;

  @ApiPropertyOptional({ example: ["team_3_plus", "commitment_12m"], description: "Specific discount rule codes to apply" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  discountCodes?: string[];

  @ApiPropertyOptional({ example: 3, description: "Number of talents in the deal (for team discount rule)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  numTalents?: number;

  @ApiPropertyOptional({ example: 12, description: "Commitment months (for commitment discount rules)" })
  @IsOptional()
  @IsInt()
  @Min(1)
  commitmentMonths?: number;

  @ApiPropertyOptional({ example: "5.00", description: "Additional manual discount percentage" })
  @IsOptional()
  @IsNumberString()
  customDiscountPct?: string;
}

export class CalculateBuyoutDto {
  @ApiProperty({ example: "2000.00", description: "Monthly client price" })
  @IsNumberString()
  monthlyClientPrice!: string;

  @ApiProperty({ example: 8, description: "Months elapsed since placement start" })
  @IsInt()
  @Min(0)
  monthsElapsed!: number;
}

