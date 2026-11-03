import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, Min } from "class-validator";

export class MarkRewardPayableDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  paidInvoicesCount!: number;

  @ApiProperty()
  @IsBoolean()
  trialPassed!: boolean;
}
