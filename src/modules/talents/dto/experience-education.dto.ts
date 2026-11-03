import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
} from "class-validator";

export class CreateExperienceDto {
  @ApiProperty({ example: "Fintech Scaleup" })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiPropertyOptional({ example: "Fintech scaleup, France" })
  @IsOptional()
  @IsString()
  publicCompanyLabel?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  hideCompanyName?: boolean = true;

  @ApiProperty({ example: "Lead Backend Developer" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: "FR" })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean = true;

  @ApiProperty({ example: "2023-01-01" })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: "2025-06-30" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: ["Node.js", "NestJS", "PostgreSQL", "Kafka"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologies?: string[];
}

export class CreateEducationDto {
  @ApiProperty({ example: "ESI - Ecole nationale Supérieure d'Informatique" })
  @IsString()
  @IsNotEmpty()
  institution!: string;

  @ApiPropertyOptional({ example: "Master of Science" })
  @IsOptional()
  @IsString()
  degree?: string;

  @ApiPropertyOptional({ example: "Software Engineering & Information Systems" })
  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @ApiPropertyOptional({ example: 2017 })
  @IsOptional()
  @IsInt()
  startYear?: number;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @IsInt()
  endYear?: number;
}

export class CreateCertificationDto {
  @ApiProperty({ example: "AWS Certified Solutions Architect - Associate" })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: "Amazon Web Services" })
  @IsOptional()
  @IsString()
  issuer?: string;

  @ApiPropertyOptional({ example: "2024-03-15" })
  @IsOptional()
  @IsDateString()
  issuedOn?: string;

  @ApiPropertyOptional({ example: "2027-03-15" })
  @IsOptional()
  @IsDateString()
  expiresOn?: string;

  @ApiPropertyOptional({ example: "https://aws.amazon.com/verify/12345" })
  @IsOptional()
  @IsUrl()
  credentialUrl?: string;
}

export class CreatePortfolioDto {
  @ApiProperty({ example: "Real-time payment gateway" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: "https://github.com/example/gateway" })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fileId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = true;
}
