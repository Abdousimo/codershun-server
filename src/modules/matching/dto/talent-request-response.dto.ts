import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  DurationBucket,
  EngagementModel,
  LostReason,
  RequestStatus,
  SeniorityLevel,
  StartWindow,
} from "../../../generated/prisma/client";

export class TalentRequestSkillItemDto {
  @ApiProperty()
  skillId!: string;

  @ApiProperty()
  skillName!: string;

  @ApiProperty()
  isRequired!: boolean;

  @ApiPropertyOptional()
  minLevel?: string | null;
}

export class TalentRequestLanguageItemDto {
  @ApiProperty()
  languageCode!: string;

  @ApiProperty()
  minLevel!: string;
}

export class TalentRequestResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiPropertyOptional()
  companyName?: string;

  @ApiPropertyOptional()
  leadId?: string | null;

  @ApiPropertyOptional()
  requestedByContactId?: string | null;

  @ApiProperty({ enum: EngagementModel })
  engagementModel!: EngagementModel;

  @ApiPropertyOptional()
  categoryId?: string | null;

  @ApiPropertyOptional()
  jobRoleId?: string | null;

  @ApiPropertyOptional()
  roleTitle?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiProperty()
  talentsCount!: number;

  @ApiPropertyOptional()
  timezoneOverlapHours?: number | null;

  @ApiPropertyOptional({ enum: StartWindow })
  startWindow?: StartWindow | null;

  @ApiPropertyOptional()
  desiredStartDate?: string | null;

  @ApiPropertyOptional({ enum: DurationBucket })
  duration?: DurationBucket | null;

  @ApiProperty()
  timeSharePct!: number;

  @ApiPropertyOptional()
  budgetMin?: string | null;

  @ApiPropertyOptional()
  budgetMax?: string | null;

  @ApiPropertyOptional()
  budgetCurrency?: string | null;

  @ApiPropertyOptional()
  indicativePriceMin?: string | null;

  @ApiPropertyOptional()
  indicativePriceMax?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: RequestStatus })
  status!: RequestStatus;

  @ApiPropertyOptional()
  recruiterId?: string | null;

  @ApiPropertyOptional()
  recruiterName?: string | null;

  @ApiPropertyOptional()
  qualifiedAt?: string | null;

  @ApiPropertyOptional()
  slaDeadlineAt?: string | null;

  @ApiProperty()
  slaBreached!: boolean;

  @ApiPropertyOptional({ description: "Hours remaining until SLA deadline (negative if breached)" })
  slaRemainingHours?: number | null;

  @ApiPropertyOptional({
    description: "SLA status flag based on elapsed hours: normal | warn_24h | warn_40h | breached",
    example: "normal",
  })
  slaWarningStage?: "normal" | "warn_24h" | "warn_40h" | "breached";

  @ApiPropertyOptional()
  firstShortlistAt?: string | null;

  @ApiPropertyOptional()
  closedAt?: string | null;

  @ApiPropertyOptional({ enum: LostReason })
  lostReason?: LostReason | null;

  @ApiPropertyOptional()
  cancelledReason?: string | null;

  @ApiProperty({ type: [TalentRequestSkillItemDto] })
  skills!: TalentRequestSkillItemDto[];

  @ApiProperty({ type: [TalentRequestLanguageItemDto] })
  languages!: TalentRequestLanguageItemDto[];

  @ApiPropertyOptional()
  shortlistsCount?: number;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
