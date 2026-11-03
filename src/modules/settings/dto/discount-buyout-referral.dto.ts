import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

import { RewardType } from "../../../generated/prisma/client";

export class CreateDiscountRuleDto {
  @ApiProperty({ example: "team_3_plus" })
  @IsString()
  code!: string;

  @ApiProperty({ example: "Team of 3+ talents" })
  @IsString()
  label!: string;

  @ApiProperty({ example: "5.00", description: "Discount percentage (e.g. 5 for 5%)" })
  @IsNumberString()
  discountPct!: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minTalents?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minCommitmentMonths?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountRuleDto {
  @ApiPropertyOptional({ example: "Team of 3+ talents" })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: "5.00" })
  @IsOptional()
  @IsNumberString()
  discountPct?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minTalents?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minCommitmentMonths?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBuyoutTierDto {
  @ApiProperty({ example: 0, description: "Start month inclusive" })
  @IsInt()
  @Min(0)
  fromMonth!: number;

  @ApiPropertyOptional({ example: 6, description: "End month exclusive. Null for open-ended." })
  @IsOptional()
  @IsInt()
  @Min(1)
  toMonth?: number;

  @ApiProperty({ example: "3.00", description: "Multiplier of monthly client price" })
  @IsNumberString()
  multiplier!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBuyoutTierDto {
  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  fromMonth?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  toMonth?: number;

  @ApiPropertyOptional({ example: "2.00" })
  @IsOptional()
  @IsNumberString()
  multiplier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateReferralRewardRuleDto {
  @ApiProperty({ enum: RewardType, example: RewardType.monthly_plan })
  @IsEnum(RewardType)
  rewardType!: RewardType;

  @ApiProperty({ example: "300.00", description: "Base reward amount" })
  @IsNumberString()
  baseAmount!: string;

  @ApiPropertyOptional({ example: "100.00", default: "0.00" })
  @IsOptional()
  @IsNumberString()
  perExtraTalentAmount?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  extraTalentThreshold?: number;

  @ApiPropertyOptional({ example: "EUR", default: "EUR" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 2, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paidInvoicesRequired?: number;

  @ApiPropertyOptional({ example: 3, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minClientMonths?: number;

  @ApiPropertyOptional({ example: 90, default: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  attributionDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateReferralRewardRuleDto {
  @ApiPropertyOptional({ example: "300.00" })
  @IsOptional()
  @IsNumberString()
  baseAmount?: string;

  @ApiPropertyOptional({ example: "100.00" })
  @IsOptional()
  @IsNumberString()
  perExtraTalentAmount?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  extraTalentThreshold?: number;

  @ApiPropertyOptional({ example: "EUR" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  paidInvoicesRequired?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minClientMonths?: number;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  attributionDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

