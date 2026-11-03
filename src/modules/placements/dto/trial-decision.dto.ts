import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateIf } from "class-validator";

export class TrialDecisionDto {
  @ApiProperty({ description: "Trial decision: 'keep' or 'replace'", example: "keep" })
  @IsIn(["keep", "replace"])
  @IsNotEmpty()
  decision!: "keep" | "replace";

  @ApiPropertyOptional({ description: "Mandatory if decision is 'replace'" })
  @ValidateIf((o: TrialDecisionDto) => o.decision === "replace")
  @IsNotEmpty({ message: "reason is required when ending a placement in trial with replace" })
  @IsString()
  @IsOptional()
  reason?: string;
}

