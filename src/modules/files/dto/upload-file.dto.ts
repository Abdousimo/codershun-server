import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";

export enum FileCategory {
  CV = "cv",
  AVATAR = "avatar",
  CONTRACT = "contract",
  INVOICE = "invoice",
  DOCUMENT = "document",
}

export const FILE_CATEGORY_RULES: Record<
  FileCategory,
  { maxBytes: number; allowedMimes: string[] }
> = {
  [FileCategory.CV]: {
    maxBytes: 5 * 1024 * 1024, // 5 MB (CDC §7.2 / 8.8)
    allowedMimes: ["application/pdf"],
  },
  [FileCategory.AVATAR]: {
    maxBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimes: ["image/jpeg", "image/png", "image/webp"],
  },
  [FileCategory.CONTRACT]: {
    maxBytes: 20 * 1024 * 1024, // 20 MB
    allowedMimes: ["application/pdf"],
  },
  [FileCategory.INVOICE]: {
    maxBytes: 20 * 1024 * 1024, // 20 MB
    allowedMimes: ["application/pdf"],
  },
  [FileCategory.DOCUMENT]: {
    maxBytes: 20 * 1024 * 1024, // 20 MB
    allowedMimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
};

export class UpdateScanStatusDto {
  @ApiProperty({ enum: ["pending", "scanning", "clean", "infected"] })
  @IsEnum(["pending", "scanning", "clean", "infected"])
  status!: "pending" | "scanning" | "clean" | "infected";
}
