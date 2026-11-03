import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  EngagementModel,
  PlacementStatus,
  Prisma,
  SeniorityLevel,
  UserRole,
} from "../../generated/prisma/client";
import { PlacementReviewsService } from "./placement-reviews.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

describe("PlacementReviewsService", () => {
  let service: PlacementReviewsService;
  let mockPrisma: any;

  const staffUser: AuthenticatedUser = {
    id: "staff-1",
    email: "staff@codershub.dz",
    role: UserRole.account_manager,
  };

  beforeEach(() => {
    mockPrisma = {
      placements: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      talentRequests: {
        create: jest.fn().mockResolvedValue({ id: "replacement-req-1" }),
      },
      trialLosses: {
        create: jest.fn().mockResolvedValue({ id: "loss-1" }),
      },
      buyoutTiers: {
        findMany: jest.fn(),
      },
      buyoutQuotes: {
        create: jest.fn(),
      },
      checkIns: {
        upsert: jest.fn(),
      },
      riskFlags: {
        create: jest.fn(),
      },
      withUserContext: jest.fn().mockImplementation((_user, cb) => cb(mockPrisma)),
    };

    service = new PlacementReviewsService(mockPrisma);
  });

  describe("FR-PLC-01 & FR-PLC-02: Trial Decisions (Keep vs Replace)", () => {
    it("FR-PLC-01: 'keep' decision transitions placement status to active", async () => {
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-trial-1",
        status: PlacementStatus.in_trial,
        companyId: "comp-1",
      });

      await service.recordTrialDecision(
        "plc-trial-1",
        { decision: "keep" },
        staffUser,
      );

      expect(mockPrisma.placements.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "plc-trial-1" },
          data: expect.objectContaining({
            status: PlacementStatus.active,
            trialDecision: "keep",
          }),
        }),
      );
    });

    it("FR-PLC-02: 'replace' decision logs trial loss and creates replacement talent request", async () => {
      const now = new Date();
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-trial-2",
        reference: "PLC-2026-1010",
        status: PlacementStatus.in_trial,
        companyId: "comp-1",
        currency: "EUR",
        talentPay: new Prisma.Decimal("1200.00"), // daily pay = 60
        startDate: now,
        engagementModel: EngagementModel.dedicated_developer,
        seniority: SeniorityLevel.senior,
        timeSharePct: 100,
      });

      await service.recordTrialDecision(
        "plc-trial-2",
        { decision: "replace", reason: "Candidate skills mismatch with stack" },
        staffUser,
      );

      // Verify trial losses record created
      expect(mockPrisma.trialLosses.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            placementId: "plc-trial-2",
            currency: "EUR",
            replacementRequestId: "replacement-req-1",
          }),
        }),
      );

      // Verify replacement request created
      expect(mockPrisma.talentRequests.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: "comp-1",
            replacesPlacementId: "plc-trial-2",
          }),
        }),
      );

      // Verify placement status updated to ended_in_trial
      expect(mockPrisma.placements.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "plc-trial-2" },
          data: expect.objectContaining({
            status: PlacementStatus.ended_in_trial,
            trialDecision: "replace",
          }),
        }),
      );
    });
  });

  describe("FR-PLC-03: Free Replacement Window", () => {
    it("FR-PLC-03: replacement within 3 months is marked as free replacement", async () => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-3",
        reference: "PLC-2026-1015",
        status: PlacementStatus.in_trial,
        companyId: "comp-1",
        currency: "EUR",
        talentPay: new Prisma.Decimal("1200.00"),
        startDate: oneMonthAgo, // 1 month ago <= 3 months
        engagementModel: EngagementModel.dedicated_developer,
        seniority: SeniorityLevel.mid,
        timeSharePct: 100,
      });

      await service.recordTrialDecision(
        "plc-3",
        { decision: "replace", reason: "Stack pivot" },
        staffUser,
      );

      expect(mockPrisma.placements.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isFreeReplacement: true,
          }),
        }),
      );
    });
  });

  describe("FR-PLC-04: Buyout Quote Computation", () => {
    it("FR-PLC-04: generates buyout quote using buyout_tiers multiplier", async () => {
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-active",
        clientPrice: new Prisma.Decimal("3000.00"),
        currency: "EUR",
        startDate: new Date("2026-01-01"),
      });

      mockPrisma.buyoutTiers.findMany.mockResolvedValue([
        { id: "tier-1", fromMonth: 0, toMonth: 6, multiplier: new Prisma.Decimal("3.0"), isActive: true },
        { id: "tier-2", fromMonth: 6, toMonth: 12, multiplier: new Prisma.Decimal("2.0"), isActive: true },
        { id: "tier-3", fromMonth: 12, toMonth: 24, multiplier: new Prisma.Decimal("1.0"), isActive: true },
      ]);

      mockPrisma.buyoutQuotes.create.mockResolvedValue({ id: "quote-1" });

      // Request quote for 8 months since start -> should pick tier-2 (multiplier: 2.0)
      await service.createBuyoutQuote(
        "plc-active",
        { monthsSinceStart: 8 },
        staffUser,
      );

      expect(mockPrisma.buyoutQuotes.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            placementId: "plc-active",
            monthsSinceStart: 8,
            multiplier: new Prisma.Decimal("2.0"),
            monthlyClientPrice: new Prisma.Decimal("3000.00"),
            currency: "EUR",
          }),
        }),
      );
    });
  });

  describe("Periodic Check-in and Risk Flags", () => {
    it("score <= 2 marks placement as at-risk and creates risk flag record", async () => {
      mockPrisma.placements.findUnique.mockResolvedValue({
        id: "plc-risk",
        reference: "PLC-2026-1020",
        companyId: "comp-1",
        accountManagerId: "am-1",
      });

      mockPrisma.checkIns.upsert.mockResolvedValue({
        id: "checkin-1",
        score: 2,
      });

      await service.recordCheckIn(
        "plc-risk",
        {
          type: "talent_monthly" as any,
          score: 2,
          comment: "Client unresponsive to PRs",
        },
        staffUser,
      );

      expect(mockPrisma.placements.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "plc-risk" },
          data: { isAtRisk: true },
        }),
      );

      expect(mockPrisma.riskFlags.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            placementId: "plc-risk",
            companyId: "comp-1",
            source: "low_checkin",
          }),
        }),
      );
    });
  });
});

