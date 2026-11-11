import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateBuyoutQuoteDto {
  @ApiPropertyOptional({ description: "Elapsed active months (if omitted, calculated from placement start date to now)" })
  @IsInt()
  @Min(0)
  @IsOptional()
  monthsSinceStart?: number;

  @ApiPropertyOptional({ description: "Target hire date" })
  @IsString()
  @IsOptional()
  targetHireDate?: string;

  @ApiPropertyOptional({ description: "Optional buyout reason or notes" })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: "Optional client agreement timestamp" })
  @IsString()
  @IsOptional()
  clientAgreedAt?: string;
}

