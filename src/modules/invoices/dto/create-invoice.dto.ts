import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from "class-validator";
import { InvoiceKind, UiLanguage } from "../../../generated/prisma/client";

export class CreateInvoiceDto {
  @ApiProperty({ enum: InvoiceKind })
  @IsEnum(InvoiceKind)
  kind: InvoiceKind = InvoiceKind.invoice;

  @ApiProperty()
  @IsUUID()
  companyId!: string;

  @ApiProperty()
  @IsUUID()
  legalEntityId!: string;

  @ApiPropertyOptional({ enum: UiLanguage, default: UiLanguage.en })
  @IsEnum(UiLanguage)
  @IsOptional()
  language?: UiLanguage = UiLanguage.en;

  @ApiProperty({ example: "EUR" })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
