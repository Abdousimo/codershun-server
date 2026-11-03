import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class IndicativePriceRangeDto {
  @ApiProperty({ example: "2000.00" })
  min!: string;

  @ApiProperty({ example: "3200.00" })
  max!: string;

  @ApiProperty({ example: "EUR" })
  currency!: string;
}

export class HireRequestResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty()
  leadId!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  contactId!: string;

  @ApiProperty()
  talentRequestId!: string;

  @ApiProperty({ type: IndicativePriceRangeDto })
  indicativePriceRange!: IndicativePriceRangeDto;

  @ApiPropertyOptional({ example: "https://calendly.com/codershub/discovery" })
  discoveryCallBookingUrl?: string;
}

export class TalentApplicationResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty()
  talentId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: "Application submitted successfully. We will review your profile shortly." })
  message!: string;
}

export class ReferrerSignupResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: "REF98765" })
  referrerCode!: string;

  @ApiProperty({ example: "https://codershub.dz/r/REF98765" })
  referralLink!: string;

  @ApiProperty({ example: "Referrer registered successfully." })
  message!: string;
}

