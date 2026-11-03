import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";

export class CreateBuyoutQuoteDto {
  @ApiPropertyOptional({ description: "Elapsed active months (if omitted, calculated from placement start date to now)" })
  @IsInt()
  @Min(0)
  @IsOptional()
  monthsSinceStart?: number;
}

