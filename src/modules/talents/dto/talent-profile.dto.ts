import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Min,
} from "class-validator";

import {
  RejectCategory,
  SeniorityLevel,
  TalentStatus,
  VettingStage,
} from "../../../generated/prisma/client";

export class CreateTalentProfileDto {
  @ApiProperty({ example: "Amine" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: "Bensalem" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: "amine@example.com" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "+213555123456" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "+213555123456" })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional({ example: "Algiers" })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: "DZ", default: "DZ" })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string = "DZ";

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobRoleId?: string;

  @ApiPropertyOptional({ example: "Senior Backend Engineer" })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ example: "5.5" })
  @IsOptional()
  @IsNumberString()
  yearsExperience?: string;

  @ApiPropertyOptional({ example: "2000.00" })
  @IsOptional()
  @IsNumberString()
  expectedPay?: string;

  @ApiPropertyOptional({ example: "EUR", default: "EUR" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  payCurrency?: string = "EUR";

  @ApiPropertyOptional({ example: "2026-12-01" })
  @IsOptional()
  @IsDateString()
  availabilityDate?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  noticePeriodDays?: number = 0;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  timeSharePct?: number = 100;

  @ApiPropertyOptional({ example: "https://linkedin.com/in/amine" })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: "https://github.com/amine" })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recruiterId?: string;
}

export class UpdateTalentProfileDto {
  @ApiPropertyOptional({ example: "Amine" })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: "Bensalem" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobRoleId?: string;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ example: "5.5" })
  @IsOptional()
  @IsNumberString()
  yearsExperience?: string;

  @ApiPropertyOptional({ example: "2000.00" })
  @IsOptional()
  @IsNumberString()
  expectedPay?: string;

  @ApiPropertyOptional({ example: "1800.00" })
  @IsOptional()
  @IsNumberString()
  currentPay?: string;

  @ApiPropertyOptional({ example: "2000.00" })
  @IsOptional()
  @IsNumberString()
  agreedPay?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  availabilityDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  noticePeriodDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  timeSharePct?: number;

  @ApiPropertyOptional({ enum: TalentStatus })
  @IsOptional()
  @IsEnum(TalentStatus)
  status?: TalentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recruiterId?: string;
}

export class UpdateTalentStageDto {
  @ApiProperty({ enum: VettingStage, example: VettingStage.tech_interview })
  @Transform(({ value }) => {
    if (value === "screened" || value === "screening") return VettingStage.screening;
    if (value === "vetting") return VettingStage.screening;
    if (value === "placed") return VettingStage.vetted;
    return value;
  })
  @IsEnum(VettingStage)
  stage!: VettingStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveTalentDto {
  @ApiProperty({ enum: SeniorityLevel, example: SeniorityLevel.senior })
  @IsEnum(SeniorityLevel)
  seniority!: SeniorityLevel;

  @ApiProperty({ example: "2000.00", description: "Agreed talent monthly net pay in EUR" })
  @IsNumberString()
  agreedPay!: string;

  @ApiPropertyOptional({ default: false, description: "Whether to publish to public talent showcase" })
  @IsOptional()
  @IsBoolean()
  showcasePublished?: boolean = false;

  @ApiPropertyOptional({ example: "Amine B.", description: "Public pseudonym / anonymised display name" })
  @IsOptional()
  @IsString()
  publicDisplayName?: string;
}

export class RejectTalentDto {
  @ApiProperty({ enum: RejectCategory, example: RejectCategory.technical })
  @IsEnum(RejectCategory)
  rejectCategory!: RejectCategory;

  @ApiPropertyOptional({ example: "Candidate scored 45/100 on technical deep dive" })
  @IsOptional()
  @IsString()
  rejectReason?: string;

  @ApiPropertyOptional({ description: "Date after which candidate may re-apply (default 6 months)" })
  @IsOptional()
  @IsDateString()
  canReapplyAfter?: string;
}

export class BlacklistTalentDto {
  @ApiProperty({ example: "Fabricated work experience and fraudulent references" })
  @IsString()
  @IsNotEmpty()
  blacklistReason!: string;
}

