import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumberString, IsOptional, IsString } from "class-validator";
import { PaymentMethod } from "../../../generated/prisma/client";

export class PayRewardDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty()
  @IsString()
  paymentReference!: string;

  @ApiPropertyOptional({ example: "10.00", default: "0.00" })
  @IsNumberString()
  @IsOptional()
  fees?: string = "0.00";
}
