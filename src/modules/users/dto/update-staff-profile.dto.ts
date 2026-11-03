import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateStaffProfileDto {
  @ApiPropertyOptional({ example: "Lead Recruiter" })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiPropertyOptional({ example: "+213555987654" })
  @IsString()
  @IsOptional()
  whatsapp?: string;

  @ApiPropertyOptional({ example: "https://cal.com/user" })
  @IsString()
  @IsOptional()
  calendarUrl?: string;

  @ApiPropertyOptional({ example: "U12345678" })
  @IsString()
  @IsOptional()
  slackUserId?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isReviewer?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isExternalReviewer?: boolean;

  @ApiPropertyOptional({ example: 75.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  reviewerFee?: number;
}

