import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  DurationBucket,
  EngagementModel,
  SeniorityLevel,
  SkillLevel,
  StartWindow,
  CefrLevel,
} from "../../../generated/prisma/client";

export class TalentRequestSkillInputDto {
  @ApiProperty({ description: "Skill UUID", example: "123e4567-e89b-12d3-a456-426614174000" })
  @IsUUID()
  @IsNotEmpty()
  skillId!: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = true;

  @ApiPropertyOptional({ enum: SkillLevel, default: SkillLevel.intermediate })
  @IsEnum(SkillLevel)
  @IsOptional()
  minLevel?: SkillLevel;
}

export class TalentRequestLanguageInputDto {
  @ApiProperty({ description: "Language code (e.g. en, fr, ar)", example: "en" })
  @IsString()
  @IsNotEmpty()
  languageCode!: string;

  @ApiPropertyOptional({ enum: CefrLevel, default: CefrLevel.B2 })
  @IsEnum(CefrLevel)
  @IsOptional()
  minLevel?: CefrLevel;
}

export class CreateTalentRequestDto {
  @ApiPropertyOptional({ description: "Company UUID (required for admin, inferred for client)" })
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional({ description: "Contact UUID who requested" })
  @IsUUID()
  @IsOptional()
  requestedByContactId?: string;

  @ApiPropertyOptional({ description: "Lead UUID if generated from CRM lead" })
  @IsUUID()
  @IsOptional()
  leadId?: string;

  @ApiPropertyOptional({ description: "Source talent ID if from 'Request this profile'" })
  @IsUUID()
  @IsOptional()
  sourceTalentId?: string;

  @ApiProperty({ enum: EngagementModel, default: EngagementModel.dedicated_developer })
  @IsEnum(EngagementModel)
  engagementModel: EngagementModel = EngagementModel.dedicated_developer;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  jobRoleId?: string;

  @ApiProperty({ description: "Role title", example: "Senior Full-Stack Node/React Engineer" })
  @IsString()
  @IsNotEmpty()
  roleTitle!: string;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  @IsEnum(SeniorityLevel)
  @IsOptional()
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  talentsCount: number = 1;

  @ApiPropertyOptional({ description: "Timezone overlap in hours (0 to 12)" })
  @IsInt()
  @Min(0)
  @Max(12)
  @IsOptional()
  timezoneOverlapHours?: number;

  @ApiPropertyOptional({ enum: StartWindow })
  @IsEnum(StartWindow)
  @IsOptional()
  startWindow?: StartWindow;

  @ApiPropertyOptional({ description: "Desired start date (ISO date)" })
  @IsString()
  @IsOptional()
  desiredStartDate?: string;

  @ApiPropertyOptional({ enum: DurationBucket })
  @IsEnum(DurationBucket)
  @IsOptional()
  duration?: DurationBucket;

  @ApiPropertyOptional({ description: "Time share percentage (50 for part-time, 100 for full-time)", default: 100 })
  @IsInt()
  @IsIn([50, 100])
  @IsOptional()
  timeSharePct: number = 100;

  @ApiPropertyOptional({ description: "Minimum budget" })
  @IsNumber()
  @IsOptional()
  budgetMin?: number;

  @ApiPropertyOptional({ description: "Maximum budget" })
  @IsNumber()
  @IsOptional()
  budgetMax?: number;

  @ApiPropertyOptional({ description: "Budget currency", default: "EUR" })
  @IsString()
  @IsOptional()
  budgetCurrency?: string = "EUR";

  @ApiPropertyOptional({ description: "Detailed job description or requirements" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: "Assigned recruiter UUID" })
  @IsUUID()
  @IsOptional()
  recruiterId?: string;

  @ApiPropertyOptional({ type: [TalentRequestSkillInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TalentRequestSkillInputDto)
  @IsOptional()
  skills?: TalentRequestSkillInputDto[];

  @ApiPropertyOptional({ type: [TalentRequestLanguageInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TalentRequestLanguageInputDto)
  @IsOptional()
  languages?: TalentRequestLanguageInputDto[];
}
