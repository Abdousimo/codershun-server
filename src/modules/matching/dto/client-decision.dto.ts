import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from "class-validator";
import { ClientDecision } from "../../../generated/prisma/client";

export class ShortlistClientDecisionDto {
  @ApiProperty({ enum: ClientDecision, description: "Client decision: interview, not_a_fit, or hire" })
  @IsEnum(ClientDecision)
  @IsNotEmpty()
  decision!: ClientDecision;

  @ApiPropertyOptional({ description: "Mandatory if decision is 'not_a_fit'" })
  @ValidateIf((o: ShortlistClientDecisionDto) => o.decision === ClientDecision.not_a_fit)
  @IsNotEmpty({ message: "clientDecisionReason is mandatory when marking a profile as not_a_fit" })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: "Optional feedback comment for the recruiter" })
  @IsString()
  @IsOptional()
  comment?: string;
}
