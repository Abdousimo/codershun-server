import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Length, Min } from "class-validator";

export class AddShortlistItemDto {
  @ApiProperty({ description: "Talent UUID to add to the shortlist", example: "123e4567-e89b-12d3-a456-426614174000" })
  @IsUUID()
  @IsNotEmpty()
  talentId!: string;

  @ApiPropertyOptional({ description: "Recruiter note explaining why this profile is a strong match" })
  @IsString()
  @IsOptional()
  recruiterNote?: string;

  @ApiPropertyOptional({ description: "Proposed monthly client price (EUR). If omitted, auto-calculated from agreed pay or rate card" })
  @IsNumber()
  @Min(0)
  @IsOptional()
  proposedClientPrice?: number;

  @ApiPropertyOptional({ default: "EUR", example: "EUR" })
  @IsString()
  @Length(3, 3)
  @IsOptional()
  proposedCurrency?: string = "EUR";
}

export class UpdateShortlistItemDto {
  @ApiPropertyOptional({ description: "Recruiter note explaining why this profile is a strong match" })
  @IsString()
  @IsOptional()
  recruiterNote?: string;

  @ApiPropertyOptional({ description: "Proposed monthly client price" })
  @IsNumber()
  @Min(0)
  @IsOptional()
  proposedClientPrice?: number;

  @ApiPropertyOptional({ default: "EUR" })
  @IsString()
  @Length(3, 3)
  @IsOptional()
  proposedCurrency?: string;

  @ApiPropertyOptional({ description: "Display sort order on the shortlist", default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
