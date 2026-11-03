import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { UserRole } from "../../../generated/prisma/client";

const VALID_STAFF_ROLES: UserRole[] = [
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.finance,
  UserRole.super_admin,
];

export class InviteStaffDto {
  @ApiProperty({ example: "staff@codershub.dz" })
  @IsEmail({}, { message: "Please provide a valid email address." })
  email!: string;

  @ApiProperty({ enum: VALID_STAFF_ROLES, example: UserRole.recruiter })
  @IsEnum(VALID_STAFF_ROLES, {
    message: "Role must be one of: recruiter, recruiter_lead, sales, account_manager, finance, super_admin.",
  })
  role!: UserRole;

  @ApiPropertyOptional({ example: "Sarah" })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: "Meziane" })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: "Senior Technical Recruiter" })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({ example: "https://cal.com/sarah-codershub" })
  @IsString()
  @IsOptional()
  calendarUrl?: string;

  @ApiPropertyOptional({ example: "+213555123456" })
  @IsString()
  @IsOptional()
  whatsapp?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  isReviewer?: boolean;

  @ApiPropertyOptional({ example: 50.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  reviewerFee?: number;
}

