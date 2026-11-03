import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { UiLanguage, UserRole, UserStatus } from "../../../generated/prisma/client";

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: UserRole })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiPropertyOptional({ example: "Amine" })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: "Larbi" })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: "+213550112233" })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: UiLanguage, default: UiLanguage.en })
  @IsEnum(UiLanguage)
  @IsOptional()
  language?: UiLanguage;

  @ApiPropertyOptional({ example: "Europe/Paris" })
  @IsString()
  @IsOptional()
  timezone?: string;
}

