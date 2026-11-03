import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { InvoiceKind, InvoiceLineKind, InvoiceStatus, PaymentMethod, UiLanguage } from "../../../generated/prisma/client";

export class InvoiceLineResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: InvoiceLineKind }) kind!: InvoiceLineKind;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() placementId?: string | null;
  @ApiProperty() quantity!: string;
  @ApiProperty() unit!: string;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() discountPct!: string;
  @ApiProperty() amount!: string;
}

export class PaymentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() receivedOn!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() currency!: string;
  @ApiProperty({ enum: PaymentMethod }) method!: PaymentMethod;
  @ApiProperty() fees!: string;
  @ApiPropertyOptional() fxRate?: string | null;
  @ApiPropertyOptional() reference?: string | null;
}

export class InvoiceResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: InvoiceKind }) kind!: InvoiceKind;
  @ApiProperty() companyId!: string;
  @ApiProperty() legalEntityId!: string;
  @ApiPropertyOptional() number?: string | null;
  @ApiProperty({ enum: InvoiceStatus }) status!: InvoiceStatus;
  @ApiProperty({ enum: UiLanguage }) language!: UiLanguage;
  @ApiProperty() currency!: string;
  @ApiProperty() subtotal!: string;
  @ApiProperty() discountTotal!: string;
  @ApiProperty() vatRate!: string;
  @ApiProperty() vatAmount!: string;
  @ApiProperty() total!: string;
  @ApiProperty() amountPaid!: string;
  @ApiProperty() balanceDue!: string;
  @ApiPropertyOptional() issueDate?: string | null;
  @ApiPropertyOptional() dueDate?: string | null;
  @ApiPropertyOptional() pdfFileId?: string | null;
  @ApiProperty({ type: [InvoiceLineResponseDto] }) lines!: InvoiceLineResponseDto[];
  @ApiProperty({ type: [PaymentResponseDto] }) payments!: PaymentResponseDto[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}
