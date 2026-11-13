import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { SeniorityLevel } from "../../../generated/prisma/client";

export class SubmitTalentApplicationDto {
  @ApiPropertyOptional({ example: "Senior Full-Stack Engineer (React, NestJS)" })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @ApiPropertyOptional({ enum: SeniorityLevel, example: SeniorityLevel.senior })
  @IsOptional()
  @IsEnum(SeniorityLevel)
  seniority?: SeniorityLevel;

  @ApiPropertyOptional({ example: "5.0" })
  @IsOptional()
  @IsNumberString()
  yearsExperience?: string;

  @ApiPropertyOptional({ example: "2000.00", description: "Expected net monthly pay in EUR" })
  @IsOptional()
  @IsNumberString()
  expectedNetPay?: string;

  @ApiPropertyOptional({ example: "+213 555 123 456" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: "Algiers" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: "https://linkedin.com/in/candidate" })
  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @ApiPropertyOptional({ example: "https://github.com/candidate" })
  @IsOptional()
  @IsString()
  githubUrl?: string;

  @ApiPropertyOptional({ example: "React, Node.js, TypeScript", description: "Comma-separated or list of skills" })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return value;
  })
  skills?: string[];
}

