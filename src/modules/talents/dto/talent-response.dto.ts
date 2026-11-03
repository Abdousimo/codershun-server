import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SeniorityLevel, TalentStatus, VettingStage } from "../../../generated/prisma/client";

export class PublicShowcaseExperienceDto {
  @ApiProperty({ example: "Fintech scaleup, France" })
  companyLabel!: string;

  @ApiProperty({ example: "Lead Backend Developer" })
  title!: string;

  @ApiProperty({ example: "2023-01-01" })
  startDate!: string;

  @ApiPropertyOptional({ example: "2025-06-30" })
  endDate?: string | null;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ example: ["Node.js", "NestJS", "PostgreSQL"] })
  technologies!: string[];
}

export class TalentShowcaseResponseDto {
  @ApiProperty({ example: "t1234567-89ab-cdef-0123-456789abcdef" })
  id!: string;

  @ApiProperty({ example: "amine-b-senior-backend" })
  publicSlug!: string;

  @ApiProperty({ example: "Amine B." })
  displayName!: string;

  @ApiPropertyOptional({ example: "Senior Backend Engineer (NestJS / Kafka)" })
  headline?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiPropertyOptional({ example: "5.5" })
  yearsExperience?: string | null;

  @ApiPropertyOptional({ example: "88.00", description: "Vetting score /100" })
  vettingScore?: string | null;

  @ApiPropertyOptional({ example: "2026-12-01" })
  availabilityDate?: string | null;

  @ApiProperty({ example: ["Node.js", "PostgreSQL", "NestJS", "Docker"] })
  skills!: string[];

  @ApiProperty({ example: [{ code: "en", level: "C1" }, { code: "fr", level: "native" }] })
  languages!: { code: string; level: string }[];

  @ApiProperty({ type: [PublicShowcaseExperienceDto] })
  experiences!: PublicShowcaseExperienceDto[];

  @ApiPropertyOptional({ example: "2400.00", description: "Indicative starting price if showcase display enabled" })
  indicativeStartingPrice?: string | null;
}

export class TalentAdminResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  whatsapp?: string | null;

  @ApiPropertyOptional()
  city?: string | null;

  @ApiProperty()
  countryCode!: string;

  @ApiPropertyOptional()
  headline?: string | null;

  @ApiPropertyOptional()
  summary?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiPropertyOptional()
  yearsExperience?: string | null;

  @ApiPropertyOptional({ description: "Candidate expected net monthly pay" })
  expectedPay?: string | null;

  @ApiPropertyOptional({ description: "Candidate current net pay" })
  currentPay?: string | null;

  @ApiPropertyOptional({ description: "Agreed net monthly pay set on approval" })
  agreedPay?: string | null;

  @ApiProperty({ enum: VettingStage })
  vettingStage!: VettingStage;

  @ApiProperty({ enum: TalentStatus })
  status!: TalentStatus;

  @ApiPropertyOptional()
  vettingScore?: string | null;

  @ApiProperty()
  isBlacklisted!: boolean;

  @ApiPropertyOptional()
  blacklistReason?: string | null;

  @ApiPropertyOptional()
  canReapplyAfter?: string | null;

  @ApiProperty()
  showcaseOptIn!: boolean;

  @ApiPropertyOptional()
  showcaseConsentAt?: string | null;

  @ApiProperty()
  showcasePublished!: boolean;

  @ApiPropertyOptional()
  publicSlug?: string | null;

  @ApiPropertyOptional()
  publicDisplayName?: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
