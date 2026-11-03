import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { FilesService } from "./files.service";
import { FileCategory } from "./dto/upload-file.dto";
import type { IStorageService } from "./storage/storage.interface";

describe("FilesService", () => {
  let service: FilesService;
  let mockPrisma: any;
  let mockStorage: jest.Mocked<IStorageService>;

  const talentUser: AuthenticatedUser = {
    id: "talent-uuid-1",
    email: "talent@example.com",
    role: UserRole.talent,
    companyId: null,
    talentId: "tal-1",
    sessionId: "sess-1",
  };

  const otherTalentUser: AuthenticatedUser = {
    id: "talent-uuid-2",
    email: "other@example.com",
    role: UserRole.talent,
    companyId: null,
    talentId: "tal-2",
    sessionId: "sess-2",
  };

  const recruiterUser: AuthenticatedUser = {
    id: "recruiter-uuid-1",
    email: "recruiter@codershub.dz",
    role: UserRole.recruiter,
    companyId: null,
    talentId: null,
    sessionId: "sess-3",
  };

  beforeEach(() => {
    mockStorage = {
      upload: jest.fn<any>().mockResolvedValue(undefined),
      getSignedDownloadUrl: jest.fn<any>().mockResolvedValue("/api/v1/files/file-uuid-1/download?sig=xyz"),
      getStream: jest.fn<any>().mockResolvedValue({} as any),
      delete: jest.fn<any>().mockResolvedValue(undefined),
      verifySignature: jest.fn<any>().mockReturnValue(true),
    };

    mockPrisma = {
      files: {
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({
            id: "file-uuid-1",
            storageKey: args.data.storageKey,
            bucket: args.data.bucket,
            originalName: args.data.originalName,
            mimeType: args.data.mimeType,
            sizeBytes: args.data.sizeBytes,
            checksumSha256: args.data.checksumSha256,
            virusScanStatus: args.data.virusScanStatus,
            uploadedBy: args.data.uploadedBy,
            createdAt: new Date("2026-11-03T12:00:00Z"),
          }),
        ),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        update: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({
            id: args.where.id,
            storageKey: "2026/11/cv.pdf",
            bucket: "local",
            originalName: "cv.pdf",
            mimeType: "application/pdf",
            sizeBytes: BigInt(1024),
            checksumSha256: "hash",
            virusScanStatus: args.data.virusScanStatus,
            uploadedBy: "talent-uuid-1",
            createdAt: new Date(),
          }),
        ),
      },
    };

    service = new FilesService(mockPrisma, mockStorage);
  });

  describe("File Validation & Local Upload (CDC §7.2 / 8.8, NFR-03)", () => {
    it("rejects CV upload exceeding 5 MB limit", () => {
      const over5Mb = 6 * 1024 * 1024;
      expect(() =>
        service.validateFile(over5Mb, "application/pdf", FileCategory.CV),
      ).toThrow(BadRequestException);
    });

    it("rejects disallowed MIME type for CV (e.g. application/octet-stream)", () => {
      const validSize = 2 * 1024 * 1024;
      expect(() =>
        service.validateFile(validSize, "application/octet-stream", FileCategory.CV),
      ).toThrow(BadRequestException);
    });

    it("accepts valid PDF CV under 5 MB", () => {
      const validSize = 3 * 1024 * 1024;
      expect(() =>
        service.validateFile(validSize, "application/pdf", FileCategory.CV),
      ).not.toThrow();
    });

    it("uploads file to local storage, calculates SHA-256, and returns file metadata with download link", async () => {
      const buffer = Buffer.from("PDF-MOCK-CONTENT");
      const file = {
        originalname: "my-resume.pdf",
        mimetype: "application/pdf",
        size: buffer.length,
        buffer,
      };

      const result = await service.uploadFile(file, FileCategory.CV, talentUser);

      expect(mockStorage.upload).toHaveBeenCalled();
      expect(mockPrisma.files.create).toHaveBeenCalled();
      expect(result.originalName).toBe("my-resume.pdf");
      expect(result.sizeBytes).toBe(buffer.length.toString());
      expect(result.checksumSha256).toBe(service.computeSha256(buffer));
      expect(result.virusScanStatus).toBe("pending");
      expect(result.downloadUrl).toBe("/api/v1/files/file-uuid-1/download?sig=xyz");
    });
  });

  describe("Permissions & Ownership (NFR-03)", () => {
    it("allows the file uploader to retrieve the file", async () => {
      mockPrisma.files.findUnique.mockResolvedValue({
        id: "file-1",
        storageKey: "2026/11/cv.pdf",
        originalName: "cv.pdf",
        uploadedBy: talentUser.id,
        virusScanStatus: "clean",
      });

      const file = await service.getFileById("file-1", talentUser);
      expect(file.id).toBe("file-1");
    });

    it("blocks a different talent from accessing another user's file", async () => {
      mockPrisma.files.findUnique.mockResolvedValue({
        id: "file-1",
        storageKey: "2026/11/cv.pdf",
        originalName: "cv.pdf",
        uploadedBy: talentUser.id,
        virusScanStatus: "clean",
      });

      await expect(service.getFileById("file-1", otherTalentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("allows staff members (e.g. recruiter) to access candidates' files", async () => {
      mockPrisma.files.findUnique.mockResolvedValue({
        id: "file-1",
        storageKey: "2026/11/cv.pdf",
        originalName: "cv.pdf",
        uploadedBy: talentUser.id,
        virusScanStatus: "clean",
      });

      const file = await service.getFileById("file-1", recruiterUser);
      expect(file.id).toBe("file-1");
    });

    it("throws NotFoundException if file does not exist", async () => {
      mockPrisma.files.findUnique.mockResolvedValue(null);
      await expect(service.getFileById("non-existent", talentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("Virus Scan Status & Download Blocking (NFR-03)", () => {
    it("generates download URL when virus scan status is clean", async () => {
      mockPrisma.files.findUnique.mockResolvedValue({
        id: "file-1",
        storageKey: "2026/11/cv.pdf",
        bucket: "local",
        originalName: "cv.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(2048),
        checksumSha256: "hash",
        virusScanStatus: "clean",
        uploadedBy: talentUser.id,
        createdAt: new Date(),
      });

      const result = await service.getDownloadUrl("file-1", talentUser);
      expect(result.downloadUrl).toBe("/api/v1/files/file-uuid-1/download?sig=xyz");
    });

    it("blocks download when virus scan status is infected", async () => {
      mockPrisma.files.findUnique.mockResolvedValue({
        id: "file-1",
        storageKey: "2026/11/cv.pdf",
        bucket: "local",
        originalName: "cv.pdf",
        mimeType: "application/pdf",
        sizeBytes: BigInt(2048),
        checksumSha256: "hash",
        virusScanStatus: "infected",
        uploadedBy: talentUser.id,
        createdAt: new Date(),
      });

      await expect(service.getDownloadUrl("file-1", talentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("allows admin to update virus scan status", async () => {
      const result = await service.updateScanStatus("file-1", "clean");
      expect(mockPrisma.files.update).toHaveBeenCalledWith({
        where: { id: "file-1" },
        data: { virusScanStatus: "clean" },
      });
      expect(result.virusScanStatus).toBe("clean");
    });
  });
});
