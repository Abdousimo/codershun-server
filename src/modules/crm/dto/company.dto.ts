import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";

import { CompanyStatus, LeadSource } from "../../../generated/prisma/client";

export class CreateCompanyDto {
  @ApiProperty({ example: "Acme Corp" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "Acme Corporation SAS" })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: "FR" })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ example: "Fintech" })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: "11-50" })
  @IsOptional()
  @IsString()
  sizeRange?: string;

  @ApiPropertyOptional({ example: "https://acme.com" })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: "FR12345678901" })
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional({ example: "10 Rue de la Paix" })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ example: "Paris" })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional({ example: "75002" })
  @IsOptional()
  @IsString()
  billingPostalCode?: string;

  @ApiPropertyOptional({ example: "FR" })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  billingCountryCode?: string;

  @ApiPropertyOptional({ example: "billing@acme.com" })
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional({ example: "EUR", default: "EUR" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: CompanyStatus, default: CompanyStatus.lead })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional({ enum: LeadSource })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workCalendarId?: string;

  @ApiPropertyOptional({ example: 7, default: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: ["tag-uuid-1"] })
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  tagIds?: string[];
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ example: "Acme Corp" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "Acme Corporation SAS" })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ example: "FR" })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ example: "Fintech" })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: "11-50" })
  @IsOptional()
  @IsString()
  sizeRange?: string;

  @ApiPropertyOptional({ example: "https://acme.com" })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: "FR12345678901" })
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 2)
  billingCountryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @ApiPropertyOptional({ example: "EUR" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus)
  status?: CompanyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workCalendarId?: string;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: ["tag-uuid-1"] })
  @IsOptional()
  @IsArray()
  @IsUUID("all", { each: true })
  tagIds?: string[];
}

