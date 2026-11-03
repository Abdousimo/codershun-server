import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Min,
} from "class-validator";

export class CreateJobCategoryDto {
  @ApiProperty({ example: "software-development" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Software Development" })
  @IsString()
  nameEn!: string;

  @ApiProperty({ example: "Développement logiciel" })
  @IsString()
  nameFr!: string;

  @ApiPropertyOptional({ example: "تطوير البرمجيات" })
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isOnRequest?: boolean;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateJobRoleDto {
  @ApiProperty({ example: "a3b84180-1234-4b82-9989-112233445566" })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ example: "full-stack-developer" })
  @IsString()
  slug!: string;

  @ApiProperty({ example: "Full-Stack Developer" })
  @IsString()
  nameEn!: string;

  @ApiProperty({ example: "Développeur Full-Stack" })
  @IsString()
  nameFr!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nameAr?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRareSkill?: boolean;

  @ApiPropertyOptional({ example: "0.00", default: "0.00" })
  @IsOptional()
  @IsNumberString()
  skillPremiumPct?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSkillDto {
  @ApiProperty({ example: "Node.js" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "nodejs" })
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRare?: boolean;

  @ApiPropertyOptional({ example: "0.00", default: "0.00" })
  @IsOptional()
  @IsNumberString()
  premiumPct?: string;

  @ApiPropertyOptional({ example: ["Node", "NodeJS"] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}

export class CreateLanguageDto {
  @ApiProperty({ example: "en" })
  @IsString()
  @Length(2, 5)
  code!: string;

  @ApiProperty({ example: "English" })
  @IsString()
  name!: string;
}

export class CreateTagDto {
  @ApiProperty({ example: "High priority" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "company", description: "Scope of the tag (e.g. company, talent, lead)" })
  @IsString()
  scope!: string;

  @ApiPropertyOptional({ example: "#FF5733" })
  @IsOptional()
  @IsString()
  color?: string;
}

export class CreateWorkCalendarDto {
  @ApiProperty({ example: "Algeria Standard" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "DZ" })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiProperty({ example: [0, 1, 2, 3, 4], description: "Days of week: 0=Sunday to 6=Saturday" })
  @IsArray()
  @IsInt({ each: true })
  workingDays!: number[];
}

export class CreatePublicHolidayDto {
  @ApiProperty({ example: "2026-07-05" })
  @IsDateString()
  holidayDate!: string;

  @ApiProperty({ example: "Independence Day" })
  @IsString()
  name!: string;
}

