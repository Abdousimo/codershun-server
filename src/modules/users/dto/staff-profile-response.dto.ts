import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class StaffProfileResponseDto {
  @ApiProperty({ type: String })
  userId!: string;

  @ApiPropertyOptional({ type: String })
  jobTitle?: string | null;

  @ApiPropertyOptional({ type: String })
  whatsapp?: string | null;

  @ApiPropertyOptional({ type: String })
  calendarUrl?: string | null;

  @ApiPropertyOptional({ type: String })
  slackUserId?: string | null;

  @ApiProperty({ type: Boolean })
  isReviewer!: boolean;

  @ApiProperty({ type: Boolean })
  isExternalReviewer!: boolean;

  @ApiPropertyOptional({ type: Number })
  reviewerFee?: number | null;
}

