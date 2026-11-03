import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import {
  EngagementModel,
  PlacementStatus,
  Prisma,
  SeniorityLevel,
  UserRole,
} from "../../generated/prisma/client";
import { PlacementsService } from "./placements.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

describe("PlacementsService", () => {
  let service: PlacementsService;
  let mockPrisma: any;
  let mockPricingService: any;
  let mockOnboardingService: any;

  const superAdminUser: AuthenticatedUser = {
    id: "admin-uuid-1",
    email: "superadmin@codershub.dz",
    role: UserRole.super_admin,
  };

  const recruiterUser: AuthenticatedUser = {
    id: "recruiter-uuid-1",
    email: "recruiter@codershub.dz",
    role: UserRole.recruiter,
  };

  beforeEach(() => {
    mockPrisma = {
      placements: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
      },
      placementStatusTransitions: {
        findUnique: jest.fn(),
      },
      companies: {
        findUnique: jest.fn().mockResolvedValue({ name: "Acme Corp" }),
      },
      talents: {
        findUnique: jest.fn<() => Promise<{
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          publicSlug: string;
          headline: string;
        }>>().mockResolvedValue({
          id: "talent-1",
          firstName: "Yacine",
          lastName: "Brahimi",
          email: "yacine@example.com",
          publicSlug: "dev-yacine-1",
          headline: "Lead Backend Architect",
        }),
      },
      legalEntities: {
        findFirst: jest.fn().mockResolvedValue({ id: "legal-1", name: "Coders Hub SAS" }),
      },
      users: {
        findUnique: jest.fn(),
      },
      withUserContext: jest.fn().mockImplementation((_user, cb) => cb(mockPrisma)),
    };

    mockPricingService = {
      calculatePricing: jest.fn().mockResolvedValue({
        grossClientPrice: "2000.00",
        netClientPrice: "2000.00",
      }),
    };

    mockOnboardingService = {
      seedOnboardingChecklist: jest.fn().mockResolvedValue(undefined),
      getOnboardingItems: jest.fn().mockResolvedValue([]),
    };

    service = new PlacementsService(mockPrisma, mockPricingService, mockOnboardingService);
  });

  describe("FR-TAL-02: Talent Allocation Capacity", () => {
    it("FR-TAL-02: rejects creating placement if talent total capacity would exceed 100%", async () => {
      // Talent already has 60% allocation
      mockPrisma.placements.findMany.mockResolvedValue([
        { timeSharePct: 60, status: PlacementStatus.active },
      ]);

      await expect(
        service.createPlacement(
          {
            companyId: "comp-1",
            talentId: "talent-1",
            talentPay: 1200,
            clientPrice: 2000,
            timeSharePct: 50, // 60 + 50 = 110% > 100%
            engagementModel: EngagementModel.dedicated_developer,
          },
          recruiterUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await service.createPlacement(
          {
            companyId: "comp-1",
            talentId: "talent-1",
            talentPay: 1200,
            clientPrice: 2000,
            timeSharePct: 50,
            engagementModel: EngagementModel.dedicated_developer,
          },
          recruiterUser,
        );
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: "FR-TAL-02",
          }),
        );
      }
    });

    it("FR-TAL-02: allows creating placement when talent capacity does not exceed 100%", async () => {
      // Talent already has 50% allocation; new request is 50% -> total 100%
      mockPrisma.placements.findMany.mockResolvedValue([
        { timeSharePct: 50, status: PlacementStatus.active },
      ]);

      mockPrisma.placements.create.mockResolvedValue({
        id: "plc-new",
        reference: "PLC-2026-1001",
        companyId: "comp-1",
        talentId: "talent-1",
        status: PlacementStatus.draft,
        currency: "EUR",
        talentPay: new Prisma.Decimal("1000.00"),
        clientPrice: new Prisma.Decimal("2000.00"),
        discountPct: new Prisma.Decimal("0.00"),
        floorMarginPct: new Prisma.Decimal("25.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-new",
        reference: "PLC-2026-1001",
        companyId: "comp-1",
        talentId: "talent-1",
        status: PlacementStatus.draft,
        currency: "EUR",
        talentPay: new Prisma.Decimal("1000.00"),
        clientPrice: new Prisma.Decimal("2000.00"),
        discountPct: new Prisma.Decimal("0.00"),
        floorMarginPct: new Prisma.Decimal("25.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createPlacement(
        {
          companyId: "comp-1",
          talentId: "talent-1",
          talentPay: 1000,
          clientPrice: 2000, // 50% margin
          timeSharePct: 50,
          engagementModel: EngagementModel.dedicated_developer,
        },
        recruiterUser,
      );

      expect(res).toBeDefined();
      expect(mockPrisma.placements.create).toHaveBeenCalled();
    });
  });

  describe("FR-PRICE-02: Margin Floor (25%) Enforcement", () => {
    it("FR-PRICE-02: rejects a low-margin override submitted by a non-Super admin", async () => {
      mockPrisma.placements.findMany.mockResolvedValue([]);

      await expect(
        service.createPlacement(
          {
            companyId: "comp-1",
            talentId: "talent-1",
            talentPay: 1600,
            clientPrice: 2000,
            timeSharePct: 100,
            engagementModel: EngagementModel.dedicated_developer,
            marginOverrideApprovedBy: recruiterUser.id,
          },
          recruiterUser,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "FR-PRICE-02" }),
      });
    });

    it("FR-PRICE-02: rejects placement with margin under 25% without Super admin approval", async () => {
      // Talent pay €1,600 with Client price €2,000 -> margin = (2000 - 1600) / 2000 = 20% < 25%
      mockPrisma.placements.findMany.mockResolvedValue([]);

      await expect(
        service.createPlacement(
          {
            companyId: "comp-1",
            talentId: "talent-1",
            talentPay: 1600,
            clientPrice: 2000, // 20% margin
            timeSharePct: 100,
            engagementModel: EngagementModel.dedicated_developer,
          },
          recruiterUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await service.createPlacement(
          {
            companyId: "comp-1",
            talentId: "talent-1",
            talentPay: 1600,
            clientPrice: 2000,
            timeSharePct: 100,
            engagementModel: EngagementModel.dedicated_developer,
          },
          recruiterUser,
        );
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: "FR-PRICE-02",
          }),
        );
      }
    });

    describe("FR-PLC-01: Trial lifecycle dates", () => {
      it("FR-PLC-01: sets a ten-working-day trial when entering in_trial", async () => {
        mockPrisma.placements.findUnique.mockResolvedValue({
          id: "plc-pending",
          reference: "PLC-2026-1021",
          talentId: "talent-1",
          status: PlacementStatus.pending_start,
          timeSharePct: 100,
          startDate: new Date("2026-11-02T00:00:00.000Z"),
          trialEndDate: null,
          talentPay: new Prisma.Decimal("1200.00"),
          clientPrice: new Prisma.Decimal("2000.00"),
          discountPct: new Prisma.Decimal("0.00"),
          floorMarginPct: new Prisma.Decimal("25.00"),
          currency: "EUR",
          isAtRisk: false,
          noticePeriodDays: 30,
          engagementModel: EngagementModel.dedicated_developer,
          createdAt: new Date("2026-11-01T00:00:00.000Z"),
          updatedAt: new Date("2026-11-01T00:00:00.000Z"),
        });
        mockPrisma.placementStatusTransitions.findUnique.mockResolvedValue({});

        await service.transitionStatus(
          "plc-pending",
          { status: PlacementStatus.in_trial },
          recruiterUser,
        );

        expect(mockPrisma.placements.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              status: PlacementStatus.in_trial,
              trialEndDate: new Date("2026-11-16T00:00:00.000Z"),
            }),
          }),
        );
      });
    });

    it("FR-PRICE-02: accepts placement with margin under 25% when Super admin override is provided", async () => {
      mockPrisma.placements.findMany.mockResolvedValue([]);
      mockPrisma.placements.create.mockResolvedValue({
        id: "plc-override",
        reference: "PLC-2026-1002",
        companyId: "comp-1",
        talentId: "talent-1",
        status: PlacementStatus.draft,
        currency: "EUR",
        talentPay: new Prisma.Decimal("1600.00"),
        clientPrice: new Prisma.Decimal("2000.00"),
        discountPct: new Prisma.Decimal("0.00"),
        floorMarginPct: new Prisma.Decimal("25.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-override",
        reference: "PLC-2026-1002",
        companyId: "comp-1",
        talentId: "talent-1",
        status: PlacementStatus.draft,
        currency: "EUR",
        talentPay: new Prisma.Decimal("1600.00"),
        clientPrice: new Prisma.Decimal("2000.00"),
        discountPct: new Prisma.Decimal("0.00"),
        floorMarginPct: new Prisma.Decimal("25.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createPlacement(
        {
          companyId: "comp-1",
          talentId: "talent-1",
          talentPay: 1600,
          clientPrice: 2000,
          timeSharePct: 100,
          engagementModel: EngagementModel.dedicated_developer,
          marginOverrideApprovedBy: superAdminUser.id,
          marginOverrideReason: "Strategic enterprise pilot partnership",
        },
        superAdminUser,
      );

      expect(res).toBeDefined();
      expect(mockPrisma.placements.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            marginOverrideApprovedBy: superAdminUser.id,
            marginOverrideReason: "Strategic enterprise pilot partnership",
          }),
        }),
      );
    });
  });

  describe("FR-PRICE-03: Price Freeze After Placement is Signed", () => {
    it("FR-PRICE-03: forbids non-super-admin from updating prices once placement is signed (non-draft)", async () => {
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-signed",
        reference: "PLC-2026-1003",
        status: PlacementStatus.active, // Signed/active!
        talentPay: new Prisma.Decimal("1200.00"),
        clientPrice: new Prisma.Decimal("2000.00"),
        currency: "EUR",
        discountPct: new Prisma.Decimal("0.00"),
      });

      await expect(
        service.updatePlacement(
          "plc-signed",
          {
            clientPrice: 2200,
          },
          recruiterUser, // Recruiter is NOT super_admin
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it("FR-PRICE-03: allows Super admin to update prices of a signed placement as an amendment", async () => {
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-signed",
        reference: "PLC-2026-1003",
        status: PlacementStatus.active,
        talentPay: new Prisma.Decimal("1200.00"),
        clientPrice: new Prisma.Decimal("2000.00"),
        currency: "EUR",
        discountPct: new Prisma.Decimal("0.00"),
        floorMarginPct: new Prisma.Decimal("25.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.updatePlacement(
        "plc-signed",
        {
          clientPrice: 2200,
        },
        superAdminUser, // Super admin can amend
      );

      expect(mockPrisma.placements.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "plc-signed" },
          data: expect.objectContaining({
            clientPrice: new Prisma.Decimal("2200"),
          }),
        }),
      );
    });
  });

  describe("FR-PRICE-04: Combined Discount Cap (12%)", () => {
    it("FR-PRICE-04: rejects placement when discountPct exceeds 12%", async () => {
      mockPrisma.placements.findMany.mockResolvedValue([]);

      await expect(
        service.createPlacement(
          {
            companyId: "comp-1",
            talentId: "talent-1",
            talentPay: 1200,
            clientPrice: 2000,
            discountPct: 15, // 15% > 12% cap
            timeSharePct: 100,
            engagementModel: EngagementModel.dedicated_developer,
          },
          recruiterUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await service.createPlacement(
          {
            companyId: "comp-1",
            talentId: "talent-1",
            talentPay: 1200,
            clientPrice: 2000,
            discountPct: 15,
            timeSharePct: 100,
            engagementModel: EngagementModel.dedicated_developer,
          },
          recruiterUser,
        );
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: "FR-PRICE-04",
          }),
        );
      }
    });
  });

  describe("FR-SEC-02: Field Visibility Rules", () => {
    it("FR-SEC-02: client view hides talent pay and margin details", async () => {
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-1",
        reference: "PLC-2026-1005",
        companyId: "client-company-1",
        talentId: "talent-1",
        status: PlacementStatus.active,
        currency: "EUR",
        clientPrice: new Prisma.Decimal("2000.00"),
        talentPay: new Prisma.Decimal("1200.00"),
        discountPct: new Prisma.Decimal("5.00"),
        floorMarginPct: new Prisma.Decimal("25.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const clientUser: AuthenticatedUser = {
        id: "client-user-1",
        email: "client@clientcorp.com",
        role: UserRole.client_admin,
        companyId: "client-company-1",
      };

      const result: any = await service.findById("plc-1", clientUser);

      expect(result.clientPrice).toBe("2000.00");
      expect(result.clientPriceNet).toBe("1900.00");
      // Hidden per FR-SEC-02
      expect(result.talentPay).toBeUndefined();
      expect(result.talentDailyPay).toBeUndefined();
      expect(result.marginAmount).toBeUndefined();
      expect(result.marginPct).toBeUndefined();
    });

    it("FR-SEC-02: talent view hides client price, discounts, and margin details", async () => {
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-1",
        reference: "PLC-2026-1005",
        companyId: "client-company-1",
        talentId: "talent-target-1",
        status: PlacementStatus.active,
        currency: "EUR",
        clientPrice: new Prisma.Decimal("2000.00"),
        talentPay: new Prisma.Decimal("1200.00"),
        discountPct: new Prisma.Decimal("5.00"),
        floorMarginPct: new Prisma.Decimal("25.00"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const talentUser: AuthenticatedUser = {
        id: "talent-user-1",
        email: "talent@example.com",
        role: UserRole.talent,
        talentId: "talent-target-1",
      };

      const result: any = await service.findById("plc-1", talentUser);

      expect(result.talentPay).toBe("1200.00");
      // Hidden per FR-SEC-02
      expect(result.clientPrice).toBeUndefined();
      expect(result.clientPriceNet).toBeUndefined();
      expect(result.discountPct).toBeUndefined();
      expect(result.marginAmount).toBeUndefined();
      expect(result.marginPct).toBeUndefined();
    });
  });
});
