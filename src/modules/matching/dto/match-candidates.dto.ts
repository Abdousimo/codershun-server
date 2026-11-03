import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SeniorityLevel } from "../../../generated/prisma/client";

export class MatchBreakdownDto {
  @ApiProperty({ description: "Points earned for skills overlap (max weight e.g. 50)" })
  skills!: number;

  @ApiProperty({ description: "Points earned for seniority alignment (max weight e.g. 20)" })
  seniority!: number;

  @ApiProperty({ description: "Points earned for availability and time-share match (max weight e.g. 15)" })
  availability!: number;

  @ApiProperty({ description: "Points earned for language requirements (max weight e.g. 10)" })
  language!: number;

  @ApiProperty({ description: "Points earned for candidate vetting scorecard score (max weight e.g. 5)" })
  vetting!: number;
}

export class MatchedCandidateDto {
  @ApiProperty()
  talentId!: string;

  @ApiProperty()
  publicSlug!: string;

  @ApiPropertyOptional()
  roleTitle?: string | null;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  seniority?: SeniorityLevel | null;

  @ApiPropertyOptional()
  experienceYears?: number | null;

  @ApiProperty({ description: "Overall match score between 0 and 100", example: 87.5 })
  matchScore!: number;

  @ApiProperty({ type: MatchBreakdownDto })
  matchBreakdown!: MatchBreakdownDto;

  @ApiProperty({ type: [String] })
  matchedSkills!: string[];

  @ApiProperty({ type: [String] })
  missingSkills!: string[];

  @ApiProperty()
  availabilityStatus!: string;

  @ApiPropertyOptional()
  availabilityDate?: string | null;

  @ApiPropertyOptional({ description: "Suggested client price calculated via PricingService" })
  suggestedMonthlyPrice?: string | null;

  @ApiPropertyOptional()
  vettingScore?: number | null;

  @ApiProperty({ description: "Whether this talent is already on a shortlist for this request" })
  isAlreadyShortlisted!: boolean;
}

