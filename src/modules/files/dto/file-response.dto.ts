import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class FileResponseDto {
  @ApiProperty({ type: String, example: "e1234567-89ab-cdef-0123-456789abcdef" })
  id!: string;

  @ApiProperty({ type: String, example: "2026/11/resume-e123.pdf" })
  storageKey!: string;

  @ApiProperty({ type: String, example: "local" })
  bucket!: string;

  @ApiProperty({ type: String, example: "resume.pdf" })
  originalName!: string;

  @ApiProperty({ type: String, example: "application/pdf" })
  mimeType!: string;

  @ApiProperty({ type: String, example: "1048576", description: "File size in bytes (as string to prevent BigInt overflow)" })
  sizeBytes!: string;

  @ApiPropertyOptional({ type: String, example: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" })
  checksumSha256?: string | null;

  @ApiProperty({ type: String, example: "clean", enum: ["pending", "scanning", "clean", "infected"] })
  virusScanStatus!: string;

  @ApiPropertyOptional({ type: String, example: "u1234567-89ab-cdef-0123-456789abcdef" })
  uploadedBy?: string | null;

  @ApiProperty({ type: String, example: "2026-11-03T12:00:00.000Z" })
  createdAt!: string;

  @ApiPropertyOptional({ type: String, description: "Download URL (direct or time-limited signed)" })
  downloadUrl?: string;
}
