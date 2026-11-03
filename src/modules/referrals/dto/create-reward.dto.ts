import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumberString, IsOptional, IsUUID } from "class-validator";
import { RewardType } from "../../../generated/prisma/client";

export class CreateRewardDto {
  @ApiProperty({ enum: RewardType })
  @IsEnum(RewardType)
  rewardType!: RewardType;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  rewardRuleId?: string;

  @ApiPropertyOptional({ example: "300.00" })
  @IsNumberString()
  @IsOptional()
  amount?: string;

  @ApiPropertyOptional({ example: "EUR", default: "EUR" })
  @IsOptional()
  currency?: string;
}
