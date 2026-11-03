import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

import { UserRole } from "../../generated/prisma/client";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { SettingsService } from "./settings.service";

describe("SettingsService", () => {
  let service: SettingsService;
  let mockPrisma: any;

  const superAdminUser: AuthenticatedUser = {
    id: "admin-uuid-1",
    email: "superadmin@codershub.dz",
    role: UserRole.super_admin,
    companyId: null,
    talentId: null,
    sessionId: "sess-1",
  };

  const financeUser: AuthenticatedUser = {
    id: "finance-uuid-1",
    email: "finance@codershub.dz",
    role: UserRole.finance,
    companyId: null,
    talentId: null,
    sessionId: "sess-2",
  };

  beforeEach(() => {
    mockPrisma = {
      settings: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        upsert: jest.fn<any>().mockImplementation((args: any) => Promise.resolve({ key: args.where.key, ...args.create })),
      },
      legalEntities: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) => Promise.resolve({ id: "entity-1", ...args.data })),
        update: jest.fn<any>().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
      },
      rateCardVersions: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>().mockImplementation((args: any) => Promise.resolve({ id: "v-1", ...args.data })),
        update: jest.fn<any>().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
        updateMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      rateCardEntries: {
        create: jest.fn<any>().mockImplementation((args: any) => Promise.resolve({ id: "entry-1", ...args.data })),
      },
      jobCategories: {
        findMany: jest.fn<any>().mockResolvedValue([{ id: "cat-1", slug: "dev", nameEn: "Development" }]),
      },
      jobRoles: {
        findMany: jest.fn<any>().mockResolvedValue([{ id: "role-1", categoryId: "cat-1", slug: "fullstack", nameEn: "Fullstack", isActive: true }]),
      },
      withUserContext: jest.fn<any>((user, fn) => fn(mockPrisma)),
    };

    service = new SettingsService(mockPrisma);
  });

  describe("Settings Management & Permissions (CDC 11.3)", () => {
    it("allows Super Admin to update any setting key", async () => {
      const result = await service.updateSetting(
        "auth.max_attempts",
        { value: 5, description: "Max failed logins" },
        superAdminUser,
      );

      expect(mockPrisma.withUserContext).toHaveBeenCalled();
      expect(result.key).toBe("auth.max_attempts");
    });

    it("allows Finance to update pricing-related setting key", async () => {
      const result = await service.updateSetting(
        "pricing.floor_margin_pct",
        { value: 25 },
        financeUser,
      );

      expect(mockPrisma.withUserContext).toHaveBeenCalled();
      expect(result.key).toBe("pricing.floor_margin_pct");
    });

    it("throws ForbiddenException when Finance attempts to edit non-pricing setting", async () => {
      await expect(
        service.updateSetting(
          "system.backup_schedule",
          { value: "daily" },
          financeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("throws NotFoundException when looking up non-existent setting", async () => {
      await expect(service.getSettingByKey("non.existent")).rejects.toThrow(NotFoundException);
    });
  });

  describe("Rate Card Versions & Entries", () => {
    it("activates rate card version by setting isCurrent = true and resetting other versions", async () => {
      const result = await service.activateRateCardVersion("version-123", superAdminUser);

      expect(mockPrisma.rateCardVersions.updateMany).toHaveBeenCalledWith({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      expect(mockPrisma.rateCardVersions.update).toHaveBeenCalledWith({
        where: { id: "version-123" },
        data: { isCurrent: true },
      });
      expect(result.isCurrent).toBe(true);
    });
  });

  describe("Reference Data & Taxonomies", () => {
    it("returns job categories with nested active roles", async () => {
      const categories = await service.getJobCategories();

      expect(categories).toHaveLength(1);
      expect(categories[0].roles).toHaveLength(1);
      expect(categories[0].roles[0].slug).toBe("fullstack");
    });
  });
});

