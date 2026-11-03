import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

import { SeniorityLevel, TalentStatus, VettingStage } from "../../../generated/prisma/client";

export class QueryTalentsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;

  @ApiPropertyOptional({ enum: VettingStage })
  @IsOptional()
  @IsEnum(VettingStage)
  stage?: VettingStage;

  @ApiPropertyOptional({ enum: TalentStatus })
  @IsOptional()
  @IsEnum(TalentStatus)
  status?: TalentStatus;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobRoleId?: string;

  @ApiPropertyOptional({ description: "Search by candidate name, email, or skills" })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Filter only available candidates" })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isAvailable?: boolean;
}

export class QueryShowcaseDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobRoleId?: string;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skill?: string;
}

