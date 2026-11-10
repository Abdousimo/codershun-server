import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class RejectTimesheetDto {
  @ApiProperty({
    description: "Detailed reason for requesting corrections on this timesheet",
    example: "Discrepancy in recorded hours on November 14 (national holiday).",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason!: string;
}

