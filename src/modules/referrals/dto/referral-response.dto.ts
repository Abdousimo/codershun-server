import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentMethod, ReferralStatus, RewardStatus, RewardType } from "../../../generated/prisma/client";

export class ReferralRewardResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: RewardType }) rewardType!: RewardType;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: RewardStatus }) status!: RewardStatus;
  @ApiProperty() paidInvoicesCount!: number;
  @ApiProperty() trialPassed!: boolean;
  @ApiPropertyOptional({ enum: PaymentMethod }) paymentMethod?: PaymentMethod | null;
  @ApiPropertyOptional() paymentReference?: string | null;
  @ApiProperty() fees!: string;
  @ApiPropertyOptional() payableAt?: string | null;
  @ApiPropertyOptional() paidAt?: string | null;
}

export class ReferralResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() referrerId!: string;
  @ApiPropertyOptional() companyId?: string | null;
  @ApiPropertyOptional() leadId?: string | null;
  @ApiPropertyOptional() referredTalentId?: string | null;
  @ApiProperty() introCompanyName!: string;
  @ApiProperty() introContactName!: string;
  @ApiProperty() introContactEmail!: string;
  @ApiProperty() introNeed!: string;
  @ApiProperty({ enum: ReferralStatus }) status!: ReferralStatus;
  @ApiProperty() attributedAt!: string;
  @ApiProperty() attributionExpiresAt!: string;
  @ApiProperty({ type: [ReferralRewardResponseDto] }) rewards!: ReferralRewardResponseDto[];
}
