import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import * as crypto from "node:crypto";
import type { Readable } from "node:stream";

import { UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import {
  FILE_CATEGORY_RULES,
  FileCategory,
} from "./dto/upload-file.dto";
import {
  FileResponseDto,
} from "./dto/file-response.dto";
import {
  STORAGE_SERVICE_TOKEN,
} from "./storage/storage.interface";
import type { IStorageService } from "./storage/storage.interface";

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  private readonly STAFF_ROLES: UserRole[] = [
    UserRole.super_admin,
    UserRole.finance,
    UserRole.sales,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.account_manager,
  ];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE_TOKEN)
    private readonly storageService: IStorageService,
  ) {}

  /**
   * Validates file size and MIME type according to category rules.
   * e.g. CV PDF <= 5 MB (CDC §7.2 / 8.8)
   */
  validateFile(size: number, mimeType: string, category: FileCategory = FileCategory.DOCUMENT): void {
    const rules = FILE_CATEGORY_RULES[category] ?? FILE_CATEGORY_RULES[FileCategory.DOCUMENT];

    if (size > rules.maxBytes) {
      const maxMb = Math.round(rules.maxBytes / (1024 * 1024));
      throw new BadRequestException(
        `File size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds allowed limit of ${maxMb} MB for ${category}`,
      );
    }

    if (!rules.allowedMimes.includes(mimeType.toLowerCase())) {
      throw new BadRequestException(
        `File type '${mimeType}' is not allowed for ${category}. Allowed types: ${rules.allowedMimes.join(", ")}`,
      );
    }
  }

  /**
   * Computes SHA-256 hash of a file buffer.
   */
  computeSha256(buffer: Buffer): string {
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Generates a date-partitioned storage key.
   */
  generateStorageKey(fileName: string): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const uuid = crypto.randomUUID();
    const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${year}/${month}/${uuid}_${sanitized}`;
  }

  /**
   * Uploads a file directly to the backend VPS upload folder and records entry in database.
   */
  async uploadFile(
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    category: FileCategory = FileCategory.DOCUMENT,
    currentUser?: AuthenticatedUser,
  ): Promise<FileResponseDto> {
    this.validateFile(file.size, file.mimetype, category);

    const checksum = this.computeSha256(file.buffer);
    const storageKey = this.generateStorageKey(file.originalname);
    const bucket = "local";

    // 1. Save directly to local VPS storage
    await this.storageService.upload(storageKey, file.buffer, file.mimetype);

    // 2. Persist metadata in files table
    const record = await this.prisma.files.create({
      data: {
        storageKey,
        bucket,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        checksumSha256: checksum,
        virusScanStatus: "pending",
        uploadedBy: currentUser?.id ?? null,
      },
    });

    // 3. Generate initial time-limited signed URL
    const downloadUrl = await this.storageService.getSignedDownloadUrl(record.id, file.originalname, 900);

    return this.mapToFileResponse(record, downloadUrl);
  }

  /**
   * Retrieves file record with ownership / permission verification.
   */
  async getFileById(id: string, currentUser?: AuthenticatedUser) {
    const file = await this.prisma.files.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(`File ${id} not found`);
    }

    this.checkFileAccess(file, currentUser);
    return file;
  }

  /**
   * Returns a time-limited signed download URL for the file.
   * Enforces: virus scan check (blocks infected files).
   */
  async getDownloadUrl(id: string, currentUser?: AuthenticatedUser): Promise<{ downloadUrl: string; file: FileResponseDto }> {
    const file = await this.getFileById(id, currentUser);

    // Block infected files
    if (file.virusScanStatus === "infected") {
      throw new ForbiddenException("File has been flagged as infected and cannot be downloaded");
    }

    const downloadUrl = await this.storageService.getSignedDownloadUrl(file.id, file.originalName, 900);
    return {
      downloadUrl,
      file: this.mapToFileResponse(file, downloadUrl),
    };
  }

  /**
   * Streams file content for direct download from the local VPS uploads directory.
   */
  async getFileStream(
    id: string,
    currentUser?: AuthenticatedUser,
    signatureData?: { expires?: string; sig?: string },
  ): Promise<{ stream: Readable; file: FileResponseDto }> {
    const file = await this.prisma.files.findUnique({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(`File ${id} not found`);
    }

    // Access check: either valid HMAC signature query or authenticated user with access
    if (signatureData?.expires && signatureData?.sig) {
      const expiresNum = parseInt(signatureData.expires, 10);
      if (!this.storageService.verifySignature(file.id, expiresNum, signatureData.sig)) {
        throw new ForbiddenException("Invalid or expired download link");
      }
    } else {
      this.checkFileAccess(file, currentUser);
    }

    if (file.virusScanStatus === "infected") {
      throw new ForbiddenException("File has been flagged as infected and cannot be downloaded");
    }

    const stream = await this.storageService.getStream(file.storageKey);
    return {
      stream,
      file: this.mapToFileResponse(file),
    };
  }

  /**
   * Updates virus scan status for a file.
   */
  async updateScanStatus(id: string, status: "pending" | "scanning" | "clean" | "infected"): Promise<FileResponseDto> {
    const file = await this.prisma.files.update({
      where: { id },
      data: { virusScanStatus: status },
    });
    return this.mapToFileResponse(file);
  }

  /**
   * Verifies whether current user is allowed to access the file.
   */
  private checkFileAccess(file: { uploadedBy: string | null }, currentUser?: AuthenticatedUser): void {
    if (!currentUser) {
      throw new ForbiddenException("Authentication required to access file");
    }

    const isStaff = this.STAFF_ROLES.includes(currentUser.role as UserRole);
    if (isStaff) {
      return;
    }

    // Talent or Client user can only access their own files
    if (file.uploadedBy && file.uploadedBy !== currentUser.id) {
      throw new ForbiddenException("You do not have permission to access this file");
    }
  }

  /**
   * Maps Prisma Files record to FileResponseDto, safely handling BigInt serialization.
   */
  mapToFileResponse(
    file: {
      id: string;
      storageKey: string;
      bucket: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      checksumSha256: string | null;
      virusScanStatus: string;
      uploadedBy: string | null;
      createdAt: Date;
    },
    downloadUrl?: string,
  ): FileResponseDto {
    return {
      id: file.id,
      storageKey: file.storageKey,
      bucket: file.bucket,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      checksumSha256: file.checksumSha256,
      virusScanStatus: file.virusScanStatus,
      uploadedBy: file.uploadedBy,
      createdAt: file.createdAt.toISOString(),
      downloadUrl,
    };
  }
}
