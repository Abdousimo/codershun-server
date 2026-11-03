import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContractType, SignatureStatus } from "../../../generated/prisma/client";

export class ContractSignatoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() party!: string;
  @ApiPropertyOptional() userId?: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() signingOrder!: number;
  @ApiPropertyOptional() signedAt?: string | null;
  @ApiPropertyOptional() declinedAt?: string | null;
}

export class ContractResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ContractType }) type!: ContractType;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() placementId?: string | null;
  @ApiPropertyOptional() companyId?: string | null;
  @ApiPropertyOptional() talentId?: string | null;
  @ApiPropertyOptional() legalEntityId?: string | null;
  @ApiPropertyOptional() fileId?: string | null;
  @ApiPropertyOptional() signedFileId?: string | null;
  @ApiProperty({ enum: SignatureStatus }) signatureStatus!: SignatureStatus;
  @ApiPropertyOptional() effectiveDate?: string | null;
  @ApiPropertyOptional() expiryDate?: string | null;
  @ApiProperty() nonSolicitMonths!: number | null;
  @ApiProperty({ type: [ContractSignatoryResponseDto] })
  signatories!: ContractSignatoryResponseDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
