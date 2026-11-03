import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  EngagementModel,
  NoticeParty,
  PlacementStatus,
  SeniorityLevel,
} from "../../../generated/prisma/client";

export class PlacementOnboardingItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  ownerSide!: string;

  @ApiProperty()
  isDone!: boolean;

  @ApiPropertyOptional()
  doneAt?: string | null;
}

/**
 * Full placement response for Admin back-office (Staff).
 */
export class AdminPlacementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  reference!: string;

  @ApiProperty()
  companyId!: string;

  @ApiPropertyOptional()
  companyName?: string;

  @ApiProperty()
  talentId!: string;

  @ApiPropertyOptional()
  talentName?: string;

  @ApiPropertyOptional()
  talentEmail?: string;

  @ApiPropertyOptional()
  requestId?: string | null;

  @ApiProperty({ enum: EngagementModel })
  engagementModel!: EngagementModel;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiProperty()
  timeSharePct!: number;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

  @ApiPropertyOptional()
  startDate?: string | null;

  @ApiPropertyOptional()
  trialEndDate?: string | null;

  @ApiPropertyOptional()
  trialDecision?: string | null;

  @ApiPropertyOptional()
  plannedEndDate?: string | null;

  @ApiPropertyOptional()
  endDate?: string | null;

  @ApiPropertyOptional()
  renewalDate?: string | null;

  @ApiPropertyOptional()
  noticeGivenAt?: string | null;

  @ApiPropertyOptional({ enum: NoticeParty })
  noticeGivenBy?: NoticeParty | null;

  @ApiProperty()
  noticePeriodDays!: number;

  @ApiPropertyOptional()
  noticeEndDate?: string | null;

  @ApiPropertyOptional()
  endReason?: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ description: "Talent net pay per month" })
  talentPay!: string;

  @ApiProperty({ description: "Client price per month" })
  clientPrice!: string;

  @ApiProperty({ description: "Discount percentage" })
  discountPct!: string;

  @ApiPropertyOptional({ description: "Net client price after discount" })
  clientPriceNet?: string | null;

  @ApiPropertyOptional({ description: "Monthly gross margin amount in currency" })
  marginAmount?: string | null;

  @ApiPropertyOptional({ description: "Gross margin percentage" })
  marginPct?: string | null;

  @ApiProperty({ description: "Floor margin percentage (default 25%)" })
  floorMarginPct!: string;

  @ApiProperty({ description: "Whether margin falls under warning threshold (< 30%)" })
  marginWarning!: boolean;

  @ApiPropertyOptional()
  marginOverrideApprovedBy?: string | null;

  @ApiPropertyOptional()
  marginOverrideReason?: string | null;

  @ApiProperty()
  isAtRisk!: boolean;

  @ApiProperty({ type: [PlacementOnboardingItemResponseDto] })
  onboardingItems!: PlacementOnboardingItemResponseDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

/**
 * Client Portal placement view (FR-SEC-02).
 * HIDES: talentPay, talentDailyPay, marginAmount, marginPct.
 */
export class ClientPlacementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  reference!: string;

  @ApiProperty()
  talentPublicSlug!: string;

  @ApiPropertyOptional()
  talentHeadline?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiProperty({ enum: EngagementModel })
  engagementModel!: EngagementModel;

  @ApiProperty()
  timeSharePct!: number;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

  @ApiPropertyOptional()
  startDate?: string | null;

  @ApiPropertyOptional()
  trialEndDate?: string | null;

  @ApiPropertyOptional()
  trialDecision?: string | null;

  @ApiPropertyOptional()
  plannedEndDate?: string | null;

  @ApiPropertyOptional()
  noticeEndDate?: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ description: "Monthly client price" })
  clientPrice!: string;

  @ApiPropertyOptional({ description: "Discount percentage applied" })
  discountPct?: string;

  @ApiPropertyOptional({ description: "Net monthly price after discounts" })
  clientPriceNet?: string | null;

  @ApiPropertyOptional()
  accountManagerName?: string | null;

  @ApiPropertyOptional()
  accountManagerEmail?: string | null;

  @ApiPropertyOptional()
  accountManagerCalendarUrl?: string | null;

  @ApiProperty({ type: [PlacementOnboardingItemResponseDto] })
  onboardingItems!: PlacementOnboardingItemResponseDto[];

  @ApiProperty()
  createdAt!: string;
}

/**
 * Talent Portal placement view (FR-SEC-02).
 * HIDES: clientPrice, clientPriceNet, discountPct, marginAmount, marginPct.
 */
export class TalentPlacementResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  reference!: string;

  @ApiPropertyOptional({ description: "Public company label to protect client confidentiality until onboarding" })
  companyName!: string;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiProperty({ enum: EngagementModel })
  engagementModel!: EngagementModel;

  @ApiProperty()
  timeSharePct!: number;

  @ApiProperty({ enum: PlacementStatus })
  status!: PlacementStatus;

  @ApiPropertyOptional()
  startDate?: string | null;

  @ApiPropertyOptional()
  trialEndDate?: string | null;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ description: "Agreed monthly talent pay" })
  talentPay!: string;

  @ApiProperty({ type: [PlacementOnboardingItemResponseDto] })
  onboardingItems!: PlacementOnboardingItemResponseDto[];

  @ApiProperty()
  createdAt!: string;
}

