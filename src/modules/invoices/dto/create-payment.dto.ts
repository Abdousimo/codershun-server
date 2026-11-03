import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { PaymentMethod } from "../../../generated/prisma/client";

export class CreatePaymentDto {
  @ApiProperty()
  @IsDateString()
  receivedOn!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: "EUR" })
  @IsString()
  currency!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  fees?: number = 0;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  fxRate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reference?: string;
}
