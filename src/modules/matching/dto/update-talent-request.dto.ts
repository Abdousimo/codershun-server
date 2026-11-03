import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from "class-validator";
import { LostReason, RequestStatus } from "../../../generated/prisma/client";
import { CreateTalentRequestDto } from "./create-talent-request.dto";

export class UpdateTalentRequestDto extends PartialType(CreateTalentRequestDto) {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  @IsOptional()
  status?: RequestStatus;

  @ApiPropertyOptional({ enum: LostReason, description: "Mandatory when status is 'lost' (FR-REQ-02)" })
  @ValidateIf((o: UpdateTalentRequestDto) => o.status === RequestStatus.lost)
  @IsNotEmpty({ message: "lostReason is mandatory when request status is lost (FR-REQ-02)" })
  @IsEnum(LostReason)
  @IsOptional()
  lostReason?: LostReason;

  @ApiPropertyOptional({ description: "Reason for cancellation" })
  @IsString()
  @IsOptional()
  cancelledReason?: string;
}

export class UpdateTalentRequestStatusDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsEnum(RequestStatus)
  @IsNotEmpty()
  status!: RequestStatus;

  @ApiPropertyOptional({ enum: LostReason, description: "Mandatory when status is 'lost' (FR-REQ-02)" })
  @ValidateIf((o: UpdateTalentRequestStatusDto) => o.status === RequestStatus.lost)
  @IsNotEmpty({ message: "lostReason is mandatory when request status is lost (FR-REQ-02)" })
  @IsEnum(LostReason)
  @IsOptional()
  lostReason?: LostReason;

  @ApiPropertyOptional({ description: "Reason for cancellation" })
  @IsString()
  @IsOptional()
  cancelledReason?: string;
}

