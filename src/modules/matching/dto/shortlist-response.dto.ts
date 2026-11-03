import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ClientDecision,
  SeniorityLevel,
  ShortlistStatus,
  TalentResponse,
} from "../../../generated/prisma/client";

export class AdminShortlistItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  talentId!: string;

  @ApiProperty()
  talentFullName!: string;

  @ApiProperty()
  talentEmail!: string;

  @ApiProperty()
  publicSlug!: string;

  @ApiPropertyOptional()
  roleTitle?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiPropertyOptional()
  matchScore?: number | null;

  @ApiPropertyOptional()
  matchBreakdown?: any;

  @ApiPropertyOptional()
  recruiterNote?: string | null;

  @ApiPropertyOptional()
  proposedClientPrice?: string | null;

  @ApiPropertyOptional()
  proposedCurrency?: string | null;

  @ApiPropertyOptional()
  agreedTalentPay?: string | null;

  @ApiProperty({ enum: TalentResponse })
  talentResponse!: TalentResponse;

  @ApiPropertyOptional()
  talentRespondedAt?: string | null;

  @ApiPropertyOptional()
  talentDeclineReason?: string | null;

  @ApiProperty({ enum: ClientDecision })
  clientDecision!: ClientDecision;

  @ApiPropertyOptional()
  clientDecisionReason?: string | null;

  @ApiPropertyOptional()
  clientComment?: string | null;

  @ApiPropertyOptional()
  clientDecidedAt?: string | null;

  @ApiProperty()
  sortOrder!: number;
}

export class AdminShortlistResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  requestId!: string;

  @ApiProperty()
  version!: number;

  @ApiProperty({ enum: ShortlistStatus })
  status!: ShortlistStatus;

  @ApiPropertyOptional()
  publishedAt?: string | null;

  @ApiPropertyOptional()
  shareExpiresAt?: string | null;

  @ApiPropertyOptional()
  shareUrl?: string | null;

  @ApiProperty({ type: [AdminShortlistItemDto] })
  items!: AdminShortlistItemDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

/**
 * Anonymised item representation for Client Portal and Public Share Link (FR-SEC-01).
 * NEVER includes email, phone, agreed pay, or margin.
 */
export class AnonymisedShortlistItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: "Public identifier/alias, e.g. dev-abc-123", example: "fullstack-react-89" })
  publicSlug!: string;

  @ApiPropertyOptional()
  roleTitle?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiPropertyOptional()
  experienceYears?: number | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiPropertyOptional()
  countryCode?: string | null;

  @ApiPropertyOptional()
  bio?: string | null;

  @ApiProperty({ type: [String] })
  skills!: string[];

  @ApiProperty({ type: [String] })
  languages!: string[];

  @ApiPropertyOptional()
  matchScore?: number | null;

  @ApiPropertyOptional()
  recruiterNote?: string | null;

  @ApiPropertyOptional({ description: "Proposed client price per month (EUR)" })
  proposedClientPrice?: string | null;

  @ApiPropertyOptional()
  proposedCurrency?: string | null;

  @ApiProperty({ enum: ClientDecision })
  clientDecision!: ClientDecision;

  @ApiPropertyOptional()
  clientDecisionReason?: string | null;

  @ApiPropertyOptional()
  clientComment?: string | null;

  @ApiProperty()
  sortOrder!: number;
}

export class ClientShortlistResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  requestId!: string;

  @ApiPropertyOptional()
  roleTitle?: string | null;

  @ApiProperty()
  version!: number;

  @ApiProperty({ enum: ShortlistStatus })
  status!: ShortlistStatus;

  @ApiPropertyOptional()
  publishedAt?: string | null;

  @ApiProperty({ type: [AnonymisedShortlistItemDto] })
  items!: AnonymisedShortlistItemDto[];
}
