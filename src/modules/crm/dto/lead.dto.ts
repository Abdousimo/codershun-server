import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from "class-validator";

import { LeadSource, LeadStage, LostReason } from "../../../generated/prisma/client";

export class CreateLeadDto {
  @ApiProperty({ example: "c1234567-89ab-cdef-0123-456789abcdef" })
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ enum: LeadStage, default: LeadStage.new_lead })
  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @ApiProperty({ enum: LeadSource, example: LeadSource.hire_form })
  @IsEnum(LeadSource)
  source!: LeadSource;

  @ApiPropertyOptional({ example: "Google search" })
  @IsOptional()
  @IsString()
  heardAboutUs?: string;

  @ApiPropertyOptional({ example: "google" })
  @IsOptional()
  @IsString()
  utmSource?: string;

  @ApiPropertyOptional({ example: "cpc" })
  @IsOptional()
  @IsString()
  utmMedium?: string;

  @ApiPropertyOptional({ example: "q1_dev_hire" })
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

  @ApiPropertyOptional({ example: "https://codershub.dz/hire" })
  @IsOptional()
  @IsString()
  landingPage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrerUrl?: string;

  @ApiPropertyOptional({ example: "REF12345" })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  referrerId?: string;

  @ApiPropertyOptional({ description: "Assigned sales owner user ID" })
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: "2000.00", description: "Estimated monthly MRR value in EUR" })
  @IsOptional()
  @IsNumberString()
  estimatedMonthlyValue?: string;

  @ApiPropertyOptional({ example: "2026-11-05T10:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  discoveryCallAt?: string;

  @ApiPropertyOptional({ example: "https://meet.google.com/abc-defg-hij" })
  @IsOptional()
  @IsString()
  discoveryCallUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional({ example: "2500.00" })
  @IsOptional()
  @IsNumberString()
  estimatedMonthlyValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  discoveryCallAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  discoveryCallUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ChangeLeadStageDto {
  @ApiProperty({ enum: LeadStage, example: LeadStage.qualified })
  @IsEnum(LeadStage)
  stage!: LeadStage;

  @ApiPropertyOptional({
    enum: LostReason,
    example: LostReason.price,
    description: "Strictly required if stage is 'lost' (Rule FR-REQ-02)",
  })
  @ValidateIf((o) => o.stage === LeadStage.lost)
  @IsNotEmpty({ message: "Lost reason is required when marking a lead as lost (FR-REQ-02)" })
  @IsEnum(LostReason)
  lostReason?: LostReason;

  @ApiPropertyOptional({ example: "Client selected internal contractor instead" })
  @IsOptional()
  @IsString()
  lostReasonDetail?: string;
}

