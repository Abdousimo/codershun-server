import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

import { UiLanguage } from "../../../generated/prisma/client";

export class PublicContactFormDto {
  @ApiProperty({ example: "Karim M." })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: "karim@tech.dz" })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: "Techdz SARL" })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: "+213555987654" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: "Partnership Inquiry" })
  @IsString()
  @IsNotEmpty()
  subject!: string;

  @ApiProperty({ example: "Hello, we are interested in placing 5 engineers next quarter..." })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  privacyPolicyAccepted!: boolean;

  @ApiPropertyOptional({ enum: UiLanguage, default: UiLanguage.en })
  @IsOptional()
  @IsEnum(UiLanguage)
  locale?: UiLanguage = UiLanguage.en;
}

