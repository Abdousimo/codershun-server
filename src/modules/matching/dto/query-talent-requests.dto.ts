import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { Transform, Type } from "class-transformer";
import { EngagementModel, RequestStatus, SeniorityLevel } from "../../../generated/prisma/client";

export class QueryTalentRequestsDto {
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

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: "Search by role title, company name, or description" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  recruiterId?: string;

  @ApiPropertyOptional({ enum: EngagementModel })
  @IsEnum(EngagementModel)
  @IsOptional()
  engagementModel?: EngagementModel;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  @IsEnum(SeniorityLevel)
  @IsOptional()
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ description: "Filter requests where SLA deadline has passed" })
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  @IsOptional()
  slaBreached?: boolean;

  @ApiPropertyOptional({ description: "Sort string, e.g. createdAt:desc, slaDeadlineAt:asc", default: "createdAt:desc" })
  @IsString()
  @IsOptional()
  sort?: string = "createdAt:desc";
}

