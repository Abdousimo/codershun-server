import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from "class-validator";
import { ReferralStatus, RewardStatus } from "../../../generated/prisma/client";

export class QueryReferralsDto {
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

  @ApiPropertyOptional({ enum: ReferralStatus })
  @IsEnum(ReferralStatus)
  @IsOptional()
  status?: ReferralStatus;

  @ApiPropertyOptional({ enum: RewardStatus })
  @IsEnum(RewardStatus)
  @IsOptional()
  rewardStatus?: RewardStatus;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  referrerId?: string;
}
