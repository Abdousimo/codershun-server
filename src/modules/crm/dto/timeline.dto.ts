import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

import { TaskStatus } from "../../../generated/prisma/client";

export class CreateNoteDto {
  @ApiProperty({ example: "lead", description: "Entity type: lead, company, talent, etc." })
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @ApiProperty({ example: "l1234567-89ab-cdef-0123-456789abcdef" })
  @IsUUID()
  @IsNotEmpty()
  entityId!: string;

  @ApiProperty({ example: "Spoke with client on phone. They need 2 full-stack engineers by Dec 1st." })
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class CreateTaskDto {
  @ApiPropertyOptional({ example: "lead" })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiProperty({ example: "Send follow-up proposal with rate card" })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: "Mid developer rates with 6-month discount" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "2026-11-05T17:00:00.000Z" })
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: "Send follow-up proposal with rate card" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}

