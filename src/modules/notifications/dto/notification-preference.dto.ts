import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsString } from "class-validator";
import { NotificationChannel } from "../../../generated/prisma/client";

export class UpdateNotificationPreferenceDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
