import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";
import { PlacementStatus } from "../../../generated/prisma/client";

export class QueryPlacementsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize?: number = 25;

  @ApiPropertyOptional({ description: "Search by placement reference, talent name, or company name" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: PlacementStatus })
  @IsEnum(PlacementStatus)
  @IsOptional()
  status?: PlacementStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  talentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  accountManagerId?: string;

  @ApiPropertyOptional({ description: "Filter only placements flagged as at-risk" })
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  @IsOptional()
  isAtRisk?: boolean;

  @ApiPropertyOptional({ default: "createdAt:desc" })
  @IsString()
  @IsOptional()
  sort?: string = "createdAt:desc";
}

