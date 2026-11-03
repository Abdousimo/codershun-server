import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { ContractType } from "../../../generated/prisma/client";

export class CreateContractDto {
  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  type!: ContractType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  placementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  companyId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  talentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  legalEntityId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  parentContractId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  effectiveDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @ApiPropertyOptional({ default: 12 })
  @IsInt()
  @Min(0)
  @IsOptional()
  nonSolicitMonths?: number;
}
