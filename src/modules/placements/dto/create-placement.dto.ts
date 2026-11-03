import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";
import { EngagementModel, SeniorityLevel } from "../../../generated/prisma/client";

export class CreatePlacementDto {
  @ApiProperty({ description: "Company UUID" })
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;

  @ApiProperty({ description: "Talent UUID" })
  @IsUUID()
  @IsNotEmpty()
  talentId!: string;

  @ApiPropertyOptional({ description: "Talent Request UUID if linked" })
  @IsUUID()
  @IsOptional()
  requestId?: string;

  @ApiPropertyOptional({ description: "Shortlist Item UUID if linked" })
  @IsUUID()
  @IsOptional()
  shortlistItemId?: string;

  @ApiPropertyOptional({ description: "Legal entity UUID for invoicing" })
  @IsUUID()
  @IsOptional()
  legalEntityId?: string;

  @ApiPropertyOptional({ description: "Account manager staff UUID" })
  @IsUUID()
  @IsOptional()
  accountManagerId?: string;

  @ApiPropertyOptional({ description: "Client manager contact UUID" })
  @IsUUID()
  @IsOptional()
  clientManagerContactId?: string;

  @ApiProperty({ enum: EngagementModel, default: EngagementModel.dedicated_developer })
  @IsEnum(EngagementModel)
  engagementModel: EngagementModel = EngagementModel.dedicated_developer;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  jobRoleId?: string;

  @ApiPropertyOptional({ enum: SeniorityLevel })
  @IsEnum(SeniorityLevel)
  @IsOptional()
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ default: 100, description: "Time share percentage (50 or 100)" })
  @IsInt()
  @IsIn([50, 100])
  @IsOptional()
  timeSharePct: number = 100;

  @ApiPropertyOptional({ default: "EUR" })
  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string = "EUR";

  @ApiProperty({ description: "Monthly talent net pay in currency", example: 1200.0 })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  talentPay!: number;

  @ApiPropertyOptional({ description: "Target margin percentage, e.g. 40.0" })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  targetMarginPct?: number;

  @ApiPropertyOptional({ description: "Client monthly price before discount. If omitted, computed via PricingService" })
  @IsNumber()
  @Min(0)
  @IsOptional()
  clientPrice?: number;

  @ApiPropertyOptional({ description: "Discount percentage (0 to 12% max per FR-PRICE-04)", default: 0 })
  @IsNumber()
  @Min(0)
  @Max(12)
  @IsOptional()
  discountPct?: number = 0;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  appliedDiscountCodes?: string[];

  @ApiPropertyOptional({ description: "Placement start date (ISO date)" })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: "Initial commitment in months, e.g. 6" })
  @IsInt()
  @Min(1)
  @IsOptional()
  commitmentMonths?: number;

  @ApiPropertyOptional({ description: "Planned end date (ISO date)" })
  @IsString()
  @IsOptional()
  plannedEndDate?: string;

  @ApiPropertyOptional({ description: "Work calendar UUID" })
  @IsUUID()
  @IsOptional()
  workCalendarId?: string;

  @ApiPropertyOptional({ description: "Client tools & environment notes" })
  @IsString()
  @IsOptional()
  clientToolsNotes?: string;

  @ApiPropertyOptional({ description: "Super admin user ID who approved margin under floor (FR-PRICE-02)" })
  @IsUUID()
  @IsOptional()
  marginOverrideApprovedBy?: string;

  @ApiPropertyOptional({ description: "Justification for margin override (FR-PRICE-02)" })
  @IsString()
  @IsOptional()
  marginOverrideReason?: string;
}

