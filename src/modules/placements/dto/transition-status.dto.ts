import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PlacementStatus } from "../../../generated/prisma/client";

export class TransitionPlacementStatusDto {
  @ApiProperty({ enum: PlacementStatus })
  @IsEnum(PlacementStatus)
  @IsNotEmpty()
  status!: PlacementStatus;

  @ApiPropertyOptional({ description: "Reason or internal note for this status change" })
  @IsString()
  @IsOptional()
  reason?: string;
}

