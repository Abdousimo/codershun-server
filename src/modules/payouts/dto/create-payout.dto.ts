import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreatePayoutDto {
  @ApiProperty()
  @IsUUID()
  talentId!: string;

  @ApiProperty()
  @IsDateString()
  periodMonth!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  legalEntityId?: string;

  @ApiProperty({ example: "EUR" })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
