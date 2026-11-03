import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from "class-validator";
import { InvoiceLineKind } from "../../../generated/prisma/client";

export class CreateInvoiceLineDto {
  @ApiProperty({ enum: InvoiceLineKind })
  @IsEnum(InvoiceLineKind)
  kind!: InvoiceLineKind;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  placementId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  timesheetId?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({ default: "month" })
  @IsString()
  @IsOptional()
  unit?: string = "month";

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPct?: number = 0;
}
