import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { NoticeParty } from "../../../generated/prisma/client";

export class GiveNoticeDto {
  @ApiProperty({ enum: NoticeParty, default: NoticeParty.client })
  @IsEnum(NoticeParty)
  @IsNotEmpty()
  noticeParty: NoticeParty = NoticeParty.client;

  @ApiPropertyOptional({ description: "Notice given date (defaults to today)" })
  @IsString()
  @IsOptional()
  noticeDate?: string;

  @ApiPropertyOptional({ description: "Notice period in days (defaults to 30)", default: 30 })
  @IsInt()
  @Min(1)
  @IsOptional()
  noticePeriodDays: number = 30;

  @ApiPropertyOptional({ description: "Reason for ending placement" })
  @IsString()
  @IsOptional()
  endReason?: string;
}

