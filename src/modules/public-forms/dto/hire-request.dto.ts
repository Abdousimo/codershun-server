import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
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
  IsUUID,
  Length,
  Min,
} from "class-validator";

import {
  DurationBucket,
  EngagementModel,
  SeniorityLevel,
  StartWindow,
  UiLanguage,
} from "../../../generated/prisma/client";

export class PublicHireRequestDto {
  // Step 1: Need
  @ApiProperty({ enum: EngagementModel, example: EngagementModel.dedicated_developer })
  @Transform(({ value }) => {
    if (!value) return EngagementModel.dedicated_developer;
    if (value === "dedicated" || value === "dedicated_developer") return EngagementModel.dedicated_developer;
    if (value === "time_material" || value === "time_and_materials" || value === "hourly" || value === "time_and_material") return EngagementModel.time_material;
    if (value === "team_extension") return EngagementModel.team_extension;
    if (value === "dedicated_team") return EngagementModel.dedicated_team;
    if (value === "project_based" || value === "direct_hire") return EngagementModel.project_based;
    return value;
  })
  @IsEnum(EngagementModel)
  engagementModel!: EngagementModel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jobRoleId?: string;

  @ApiPropertyOptional({ example: "Senior Full-Stack Node/React Engineer" })
  @IsOptional()
  @IsString()
  roleTitle?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  talentsCount?: number = 1;

  // Step 2: Profile
  @ApiPropertyOptional({ enum: SeniorityLevel, example: SeniorityLevel.senior })
  @Transform(({ value }) => {
    if (value === "principal") return SeniorityLevel.lead;
    return value;
  })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ example: ["skill-uuid-1", "skill-uuid-2"] })
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  skillIds?: string[];

  @ApiPropertyOptional({ example: ["en", "fr"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languageCodes?: string[];

  @ApiPropertyOptional({ example: 4, description: "Required time zone overlap hours with client" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  timezoneOverlapHours?: number;

  // Step 3: Timing & Budget
  @ApiPropertyOptional({ enum: StartWindow, example: StartWindow.two_weeks })
  @IsOptional()
  @IsEnum(StartWindow)
  startWindow?: StartWindow;

  @ApiPropertyOptional({ example: "2026-12-01" })
  @IsOptional()
  @IsDateString()
  desiredStartDate?: string;

  @ApiPropertyOptional({ enum: DurationBucket, example: DurationBucket.sixToTwelveMonths })
  @IsOptional()
  @IsEnum(DurationBucket)
  duration?: DurationBucket;

  @ApiPropertyOptional({ default: false, description: "Whether this is a 50% part-time placement" })
  @IsOptional()
  @IsBoolean()
  isPartTime?: boolean = false;

  @ApiPropertyOptional({ example: "2500.00" })
  @IsOptional()
  @IsNumberString()
  budgetMin?: string;

  @ApiPropertyOptional({ example: "3500.00" })
  @IsOptional()
  @IsNumberString()
  budgetMax?: string;

  @ApiPropertyOptional({ example: "EUR", default: "EUR" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  budgetCurrency?: string = "EUR";

  // Step 4: Contact & Company
  @ApiProperty({ example: "Sarah Connor" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "s.connor@cyberdyne.fr" })
  @IsEmail()
  workEmail!: string;

  @ApiProperty({ example: "Cyberdyne Systems" })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiProperty({ example: "FR" })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiPropertyOptional({ example: "https://cyberdyne.com" })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: "+33612345678" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: "LinkedIn" })
  @IsOptional()
  @IsString()
  heardAboutUs?: string;

  @ApiPropertyOptional({ example: "REF12345" })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({ description: "Attached talent ID if inquiry started from public talent card" })
  @IsOptional()
  @IsUUID()
  sourceTalentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  // Attribution & Consents
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmMedium?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmCampaign?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmTerm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  utmContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landingPage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerUrl?: string;

  @ApiProperty({ example: true, description: "GDPR privacy policy consent" })
  @IsBoolean()
  privacyPolicyAccepted!: boolean;

  @ApiPropertyOptional({ enum: UiLanguage, default: UiLanguage.en })
  @IsOptional()
  @IsEnum(UiLanguage)
  locale?: UiLanguage = UiLanguage.en;
}

