import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

export class QueryStatusHistoryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({ default: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  pageSize = 25;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  changedBy?: string;
}
