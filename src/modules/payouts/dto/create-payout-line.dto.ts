import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { PayoutLineKind } from "../../../generated/prisma/client";

export class CreatePayoutLineDto {
  @ApiProperty({ enum: PayoutLineKind })
  @IsEnum(PayoutLineKind)
  kind!: PayoutLineKind;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  placementId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  days?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyRate?: number;

  @ApiProperty()
  @IsNumber()
  amount!: number;
}
