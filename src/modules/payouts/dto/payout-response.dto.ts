import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentMethod, PayoutLineKind, PayoutStatus } from "../../../generated/prisma/client";

export class PayoutLineResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: PayoutLineKind }) kind!: PayoutLineKind;
  @ApiPropertyOptional() placementId?: string | null;
  @ApiPropertyOptional() description?: string | null;
  @ApiPropertyOptional() days?: string | null;
  @ApiPropertyOptional() dailyRate?: string | null;
  @ApiProperty() amount!: string;
}

export class PayoutResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() talentId!: string;
  @ApiPropertyOptional() legalEntityId?: string | null;
  @ApiProperty() periodMonth!: string;
  @ApiProperty({ enum: PayoutStatus }) status!: PayoutStatus;
  @ApiProperty() currency!: string;
  @ApiProperty() grossAmount!: string;
  @ApiProperty() adjustmentsTotal!: string;
  @ApiProperty() netAmount!: string;
  @ApiPropertyOptional() paidCurrency?: string | null;
  @ApiPropertyOptional() fxRate?: string | null;
  @ApiPropertyOptional() paidAmount?: string | null;
  @ApiProperty() fees!: string;
  @ApiPropertyOptional({ enum: PaymentMethod }) method?: PaymentMethod | null;
  @ApiPropertyOptional() transferReference?: string | null;
  @ApiProperty({ type: [PayoutLineResponseDto] }) lines!: PayoutLineResponseDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
