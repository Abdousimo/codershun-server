import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { PayoutStatus } from "../../../generated/prisma/client";

export class QueryPayoutsDto {
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

  @ApiPropertyOptional({ enum: PayoutStatus })
  @IsEnum(PayoutStatus)
  @IsOptional()
  status?: PayoutStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  talentId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  currency?: string;
}
