import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

import { PaymentMethod, ReferrerKind, UiLanguage } from "../../../generated/prisma/client";

export class PublicReferrerSignupDto {
  @ApiProperty({ example: "Sofiane K." })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "sofiane@ambassador.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ReferrerKind, example: ReferrerKind.partner })
  @IsEnum(ReferrerKind)
  kind!: ReferrerKind;

  @ApiPropertyOptional({ example: "Sofiane Consulting" })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: "+213555333222" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, example: PaymentMethod.payoneer })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: { payoneerEmail: "sofiane@payoneer.com" } })
  @IsOptional()
  @IsObject()
  paymentDetails?: Record<string, unknown>;

  @ApiProperty({ example: true, description: "Referral terms and conditions accepted" })
  @IsBoolean()
  termsAccepted!: boolean;

  @ApiPropertyOptional({ enum: UiLanguage, default: UiLanguage.en })
  @IsOptional()
  @IsEnum(UiLanguage)
  locale?: UiLanguage = UiLanguage.en;
}

