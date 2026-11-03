import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";

export class UpdateSettingDto {
  @ApiProperty({ description: "JSON value for the setting" })
  @IsNotEmpty()
  value!: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateLegalEntityDto {
  @ApiProperty({ example: "Coders Hub SARL" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "SARL" })
  @IsOptional()
  @IsString()
  legalForm?: string;

  @ApiProperty({ example: "DZ" })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiPropertyOptional({ example: "16/00-1234567B16" })
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional({ example: "001616012345678" })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional({ example: "123 Rue Didouche Mourad, Algiers" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: "Banque Nationale d'Algérie" })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: "DZ0012345678901234567890" })
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiPropertyOptional({ example: "BNALDZALXXX" })
  @IsOptional()
  @IsString()
  swiftBic?: string;

  @ApiPropertyOptional({ example: "finance@codershub.dz" })
  @IsOptional()
  @IsString()
  payoneerAccount?: string;

  @ApiProperty({ example: "EUR" })
  @IsString()
  @Length(3, 3)
  defaultCurrency!: string;

  @ApiProperty({ example: "INV-DZ" })
  @IsString()
  invoicePrefix!: string;

  @ApiPropertyOptional({ example: "CN-DZ", default: "CN" })
  @IsOptional()
  @IsString()
  creditNotePrefix?: string;

  @ApiPropertyOptional({ example: { reverseChargeMention: "Exonération de TVA art. ...", footer: "..." } })
  @IsOptional()
  @IsObject()
  taxMentions?: Record<string, unknown>;

  @ApiPropertyOptional({ example: "0.00", default: "0.00" })
  @IsOptional()
  @IsNumberString()
  defaultVatRate?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  acceptsCardPayments?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLegalEntityDto {
  @ApiPropertyOptional({ example: "Coders Hub SARL" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: "SARL" })
  @IsOptional()
  @IsString()
  legalForm?: string;

  @ApiPropertyOptional({ example: "DZ" })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iban?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  swiftBic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payoneerAccount?: string;

  @ApiPropertyOptional({ example: "EUR" })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  defaultCurrency?: string;

  @ApiPropertyOptional({ example: "INV-DZ" })
  @IsOptional()
  @IsString()
  invoicePrefix?: string;

  @ApiPropertyOptional({ example: "CN-DZ" })
  @IsOptional()
  @IsString()
  creditNotePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  taxMentions?: Record<string, unknown>;

  @ApiPropertyOptional({ example: "0.00" })
  @IsOptional()
  @IsNumberString()
  defaultVatRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  acceptsCardPayments?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCurrencyDto {
  @ApiProperty({ example: "EUR" })
  @IsString()
  @Length(3, 3)
  code!: string;

  @ApiProperty({ example: "Euro" })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: "€" })
  @IsOptional()
  @IsString()
  symbol?: string;

  @ApiPropertyOptional({ example: 2, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minorUnits?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isClientCurrency?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateFxRateDto {
  @ApiProperty({ example: "EUR" })
  @IsString()
  @Length(3, 3)
  baseCurrency!: string;

  @ApiProperty({ example: "DZD" })
  @IsString()
  @Length(3, 3)
  quoteCurrency!: string;

  @ApiProperty({ example: "145.50000000" })
  @IsNumberString()
  rate!: string;

  @ApiProperty({ example: "2026-01-01" })
  @IsDateString()
  rateDate!: string;

  @ApiPropertyOptional({ example: "Bank of Algeria Official" })
  @IsOptional()
  @IsString()
  source?: string;
}

