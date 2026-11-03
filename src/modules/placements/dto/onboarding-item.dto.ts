import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateOnboardingItemDto {
  @ApiProperty({ description: "Mark checklist item as completed or incomplete" })
  @IsBoolean()
  @IsNotEmpty()
  isDone!: boolean;

  @ApiPropertyOptional({ description: "Notes or confirmation reference" })
  @IsString()
  @IsOptional()
  note?: string;
}

