import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
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
  ValidateNested,
} from "class-validator";

import { CefrLevel, SeniorityLevel, UiLanguage } from "../../../generated/prisma/client";

export class ApplicationLanguageDto {
  @ApiProperty({ example: "en" })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ enum: CefrLevel, example: CefrLevel.C1 })
  @IsEnum(CefrLevel)
  level!: CefrLevel;
}

export class PublicTalentApplicationDto {
  @ApiProperty({ example: "Amine" })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: "Bensalem" })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: "amine.bensalem@gmail.com" })
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

  @ApiPropertyOptional({ example: "Senior Backend Engineer (NestJS / PostgreSQL)" })
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional({ enum: SeniorityLevel, example: SeniorityLevel.senior })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ example: "5.5" })
  @IsOptional()
  @IsNumberString()
  yearsExperience?: string;

  @ApiPropertyOptional({ example: "https://linkedin.com/in/amine-bensalem" })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: "https://github.com/amine-dz" })
  @IsOptional()
  @IsUrl()
  githubUrl?: string;

  @ApiPropertyOptional({ example: "https://amine.dev" })
  @IsOptional()
  @IsUrl()
  portfolioUrl?: string;

  @ApiProperty({ example: "2000.00", description: "Expected net monthly pay in EUR" })
  @IsNumberString()
  expectedNetPay!: string;

  @ApiPropertyOptional({ example: "EUR", default: "EUR" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  payCurrency?: string = "EUR";

  @ApiPropertyOptional({ example: "2026-12-01" })
  @IsOptional()
  @IsDateString()
  availabilityDate?: string;

  @ApiPropertyOptional({ example: 30, description: "Notice period in days" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  noticePeriodDays?: number = 0;

  @ApiPropertyOptional({ example: 100, default: 100, description: "100 for full-time, 50 for part-time" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  timeSharePct?: number = 100;

  @ApiPropertyOptional({ example: ["skill-uuid-1", "skill-uuid-2"] })
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({ type: [ApplicationLanguageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplicationLanguageDto)
  languages?: ApplicationLanguageDto[];

  @ApiPropertyOptional({ description: "Uploaded CV file ID if uploaded previously" })
  @IsOptional()
  @IsUUID()
  cvFileId?: string;

  @ApiPropertyOptional({ default: false, description: "Consent to show profile on anonymised public talent showcase" })
  @IsOptional()
  @IsBoolean()
  showcaseOptIn?: boolean = false;

  @ApiProperty({ example: true, description: "GDPR privacy policy consent" })
  @IsBoolean()
  privacyPolicyAccepted!: boolean;

  @ApiPropertyOptional({ enum: UiLanguage, default: UiLanguage.en })
  @IsOptional()
  @IsEnum(UiLanguage)
  locale?: UiLanguage = UiLanguage.en;
}

