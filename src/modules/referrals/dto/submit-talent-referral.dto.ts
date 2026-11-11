import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class SubmitTalentReferralDto {
  @ApiProperty({ example: "Acme Corp" })
  @IsString()
  @IsNotEmpty()
  introCompanyName!: string;

  @ApiProperty({ example: "Sarah Connor" })
  @IsString()
  @IsNotEmpty()
  introContactName!: string;

  @ApiProperty({ example: "sarah@acme.com" })
  @IsEmail()
  @IsNotEmpty()
  introContactEmail!: string;

  @ApiProperty({ example: "Looking for 2 Senior React / Node.js engineers" })
  @IsString()
  @IsNotEmpty()
  introNeed!: string;

  @ApiPropertyOptional({ example: "client", default: "client" })
  @IsString()
  @IsOptional()
  referralKind?: string;
}
