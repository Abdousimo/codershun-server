import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString, Length, Min } from "class-validator";
import { PaymentMethod } from "../../../generated/prisma/client";

export class MarkPaidDto {
  @ApiProperty({ example: "EUR" })
  @IsString()
  @Length(3, 3)
  paidCurrency!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  paidAmount!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  fxRate!: number;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  fees?: number = 0;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty()
  @IsString()
  transferReference!: string;
}
