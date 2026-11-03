import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class CreateShortlistDto {
  @ApiPropertyOptional({ description: "Internal notes or title for this shortlist draft" })
  @IsString()
  @IsOptional()
  notes?: string;
}
