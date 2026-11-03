import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateReferralDto {
  @ApiProperty()
  @IsUUID()
  referrerId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  leadId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  referredTalentId?: string;

  @ApiProperty()
  @IsString()
  introCompanyName!: string;

  @ApiProperty()
  @IsString()
  introContactName!: string;

  @ApiProperty()
  @IsEmail()
  introContactEmail!: string;

  @ApiProperty()
  @IsString()
  introNeed!: string;
}
