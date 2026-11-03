import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional, IsString, IsUUID } from "class-validator";
import { NotificationChannel, Prisma } from "../../../generated/prisma/client";

export class CreateNotificationDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recipientEmail?: string;

  @ApiProperty()
  @IsString()
  type!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ default: {} })
  @IsObject()
  @IsOptional()
  payload?: Prisma.InputJsonObject = {};

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  linkUrl?: string;

  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @ApiPropertyOptional({ description: "Email template code, required for email notifications" })
  @IsString()
  @IsOptional()
  templateCode?: string;
}
