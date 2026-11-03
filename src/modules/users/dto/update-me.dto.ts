import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { UiLanguage } from "../../../generated/prisma/client";

export class UpdateMeDto {
  @ApiPropertyOptional({ example: "Yacine" })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: "Brahimi" })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: "+213550998877" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: UiLanguage })
  @IsEnum(UiLanguage)
  @IsOptional()
  language?: UiLanguage;

  @ApiPropertyOptional({ example: "Africa/Algiers" })
  @IsString()
  @IsOptional()
  timezone?: string;
}

