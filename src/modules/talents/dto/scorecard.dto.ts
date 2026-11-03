import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { Recommendation } from "../../../generated/prisma/client";

export class ScorecardCriterionScoreDto {
  @ApiProperty({ example: "System Design & Architecture" })
  @IsString()
  @IsNotEmpty()
  criterion!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  skillId?: string;

  @ApiProperty({ example: 85, description: "Score /100" })
  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;

  @ApiPropertyOptional({ example: "Strong understanding of distributed transactions and event sourcing" })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class CreateScorecardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vettingStepId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reviewerId?: string;

  @ApiProperty({ example: "82.50", description: "Overall total score /100" })
  @IsNumberString()
  totalScore!: string;

  @ApiProperty({ enum: Recommendation, example: Recommendation.strong_yes })
  @IsEnum(Recommendation)
  recommendation!: Recommendation;

  @ApiPropertyOptional({ example: "Deep experience with high-load Node.js microservices" })
  @IsOptional()
  @IsString()
  strengths?: string;

  @ApiPropertyOptional({ example: "Could improve cloud infrastructure automation knowledge" })
  @IsOptional()
  @IsString()
  concerns?: string;

  @ApiProperty({ type: [ScorecardCriterionScoreDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScorecardCriterionScoreDto)
  scores!: ScorecardCriterionScoreDto[];
}

