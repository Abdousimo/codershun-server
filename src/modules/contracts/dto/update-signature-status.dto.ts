import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { SignatureStatus } from "../../../generated/prisma/client";

export class UpdateSignatureStatusDto {
  @ApiProperty({ enum: SignatureStatus })
  @IsEnum(SignatureStatus)
  status!: SignatureStatus;
}
