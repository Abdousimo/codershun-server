import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, Length } from "class-validator";
import { UiLanguage } from "../../../generated/prisma/client";

export class UpsertEmailTemplateDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  code!: string;

  @ApiProperty({ enum: UiLanguage })
  @IsEnum(UiLanguage)
  language!: UiLanguage;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty()
  @IsString()
  bodyHtml!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bodyText?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[] = [];

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
