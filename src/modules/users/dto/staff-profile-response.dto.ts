import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StaffProfileResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiPropertyOptional()
  jobTitle?: string | null;

  @ApiPropertyOptional()
  whatsapp?: string | null;

  @ApiPropertyOptional()
  calendarUrl?: string | null;

  @ApiPropertyOptional()
  slackUserId?: string | null;

  @ApiProperty()
  isReviewer!: boolean;

  @ApiProperty()
  isExternalReviewer!: boolean;

  @ApiPropertyOptional()
  reviewerFee?: number | null;
}

