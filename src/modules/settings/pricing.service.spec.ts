import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { Prisma } from "../../generated/prisma/client";
import { SeniorityLevel } from "../../generated/prisma/client";
import { PricingService } from "./pricing.service";

describe("PricingService", () => {
  let service: PricingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      rateCardVersions: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      rateCardEntries: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      discountRules: {
        findMany: jest.fn().mockResolvedValue([
          { code: "team_3_plus", label: "Team 3+", discountPct: new Prisma.Decimal("5.00"), minTalents: 3, isActive: true },
          { code: "commitment_6m", label: "6m commitment", discountPct: new Prisma.Decimal("5.00"), minCommitmentMonths: 6, isActive: true },
          { code: "annual_12m", label: "Annual 12m", discountPct: new Prisma.Decimal("10.00"), minCommitmentMonths: 12, isActive: true },
        ]),
      },
      buyoutTiers: {
        findMany: jest.fn().mockResolvedValue([
          { fromMonth: 0, toMonth: 6, multiplier: new Prisma.Decimal("3.00"), isActive: true },
          { fromMonth: 6, toMonth: 12, multiplier: new Prisma.Decimal("2.00"), isActive: true },
          { fromMonth: 12, toMonth: 24, multiplier: new Prisma.Decimal("1.00"), isActive: true },
          { fromMonth: 24, toMonth: null, multiplier: new Prisma.Decimal("0.00"), isActive: true },
        ]),
      },
    };

    service = new PricingService(mockPrisma);
  });

  describe("Rule FR-PRICE-01: Client price formula & live recalculation", () => {
    it("FR-PRICE-01: calculates client price as talent_pay / (1 - margin) for Junior", async () => {
      // Junior: 700 / (1 - 0.44) = 700 / 0.56 = 1250, margin = 550
      const result = await service.calculatePricing({
        seniority: SeniorityLevel.junior,
      });

      expect(result.talentPay).toBe("700.00");
      expect(result.grossClientPrice).toBe("1250.00");
      expect(result.grossMarginAmount).toBe("550.00");
      expect(result.grossMarginPct).toBe("44.00");
    });

    it("FR-PRICE-01: calculates client price as talent_pay / (1 - margin) for Mid", async () => {
      // Mid: 1200 / (1 - 0.40) = 1200 / 0.60 = 2000, margin = 800
      const result = await service.calculatePricing({
        seniority: SeniorityLevel.mid,
      });

      expect(result.talentPay).toBe("1200.00");
      expect(result.grossClientPrice).toBe("2000.00");
      expect(result.grossMarginAmount).toBe("800.00");
      expect(result.grossMarginPct).toBe("40.00");
    });

    it("FR-PRICE-01: calculates client price as talent_pay / (1 - margin) for Senior", async () => {
      // Senior: 2000 / (1 - 0.375) = 2000 / 0.625 = 3200, margin = 1200
      const result = await service.calculatePricing({
        seniority: SeniorityLevel.senior,
      });

      expect(result.talentPay).toBe("2000.00");
      expect(result.grossClientPrice).toBe("3200.00");
      expect(result.grossMarginAmount).toBe("1200.00");
      expect(result.grossMarginPct).toBe("37.50");
    });

    it("FR-PRICE-01: allows manual client price override and recalculates margin live", async () => {
      // Mid talent (1200) overridden with client price 1800
      // marginAmount = 1800 - 1200 = 600
      // marginPct = 600 / 1800 = 33.33%
      const result = await service.calculatePricing({
        seniority: SeniorityLevel.mid,
        overrideClientPrice: "1800.00",
      });

      expect(result.grossClientPrice).toBe("1800.00");
      expect(result.grossMarginAmount).toBe("600.00");
      expect(result.grossMarginPct).toBe("33.33");
    });
  });

  describe("Rule FR-PRICE-03: Rate card snapshot preservation", () => {
    it("FR-PRICE-03: uses specific rate card version snapshot when rateCardVersionId is provided", async () => {
      const versionId = "v1-historical-snapshot-id";
      mockPrisma.rateCardVersions.findUnique.mockResolvedValue({
        id: versionId,
        hoursPerMonth: new Prisma.Decimal("150.00"),
        tmPremiumPct: new Prisma.Decimal("20.00"),
        hoursPerDay: new Prisma.Decimal("7.50"),
        partTimePricePct: new Prisma.Decimal("60.00"),
        floorMarginPct: new Prisma.Decimal("20.00"),
        warningMarginPct: new Prisma.Decimal("28.00"),
        maxCombinedDiscountPct: new Prisma.Decimal("10.00"),
      });

      mockPrisma.rateCardEntries.findMany.mockResolvedValue([
        {
          seniority: SeniorityLevel.mid,
          talentNetPay: new Prisma.Decimal("1100.00"),
          targetMarginPct: new Prisma.Decimal("45.00"),
        },
      ]);

      const result = await service.calculatePricing({
        rateCardVersionId: versionId,
        seniority: SeniorityLevel.mid,
      });

      expect(result.rateCardVersionId).toBe(versionId);
      expect(result.talentPay).toBe("1100.00");
      // 1100 / (1 - 0.45) = 1100 / 0.55 = 2000.00
      expect(result.grossClientPrice).toBe("2000.00");
      expect(result.grossMarginPct).toBe("45.00");
    });
  });

  describe("Rule FR-PRICE-04: Discounts capped at 12% combined & never reduce talent pay", () => {
    it("FR-PRICE-04: applies combined discounts and caps them at maxCombinedDiscountPct (12%)", async () => {
      // Mid: 1200 pay, 2000 client price
      // Requested discounts: team 3+ (5%) + annual 12m (10%) = 15% combined
      // Must be capped at 12%
      const result = await service.calculatePricing({
        seniority: SeniorityLevel.mid,
        numTalents: 3,
        commitmentMonths: 12,
      });

      // Total discount capped at 12%
      expect(result.discountPct).toBe("12.00");
      // Discount amount: 2000 * 12% = 240
      expect(result.discountAmount).toBe("240.00");
      // Net client price: 2000 - 240 = 1760
      expect(result.netClientPrice).toBe("1760.00");
      // Talent pay is NEVER reduced: still 1200
      expect(result.talentPay).toBe("1200.00");
      // Agency absorbs discount: margin = 1760 - 1200 = 560
      expect(result.netMarginAmount).toBe("560.00");
      // Net margin pct: 560 / 1760 = 31.82%
      expect(result.netMarginPct).toBe("31.82");
      // 31.82% is above warning (30%) and floor (25%)
      expect(result.isUnderWarningMargin).toBe(false);
      expect(result.isUnderFloorMargin).toBe(false);
    });

    it("FR-PRICE-04: flags warning when net margin is under 30% and floor when under 25%", async () => {
      // Overridden price with high discount bringing margin under 25%
      const result = await service.calculatePricing({
        talentNetPay: "1200.00",
        overrideClientPrice: "1550.00",
        customDiscountPct: "10.00",
      });

      // Gross client price: 1550
      // 10% discount: 155
      // Net client price: 1395
      // Net margin: 1395 - 1200 = 195
      // Net margin %: 195 / 1395 = 13.98%
      expect(result.isUnderWarningMargin).toBe(true);
      expect(result.isUnderFloorMargin).toBe(true);
    });
  });

  describe("T&M and Part-Time Calculations", () => {
    it("calculates T&M hourly and daily rates with flexibility premium", async () => {
      // Mid: 2000 client price
      // Hourly: 2000 / 160 * 1.15 = 12.5 * 1.15 = 14.375 -> 14.38
      // Daily: 14.375 * 8 = 115.00
      // Talent daily pay: 1200 / (160 / 8) = 1200 / 20 = 60.00
      const result = await service.calculatePricing({
        seniority: SeniorityLevel.mid,
      });

      expect(result.hourlyRate).toBe("14.38");
      expect(result.dailyRate).toBe("115.00");
      expect(result.talentDailyPay).toBe("60.00");
    });

    it("calculates 50% part-time placement at 55% of full-time price", async () => {
      // Mid full-time: 2000 client price, 1200 pay
      // Part-time: 2000 * 55% = 1100 client price
      // Talent pay: 1200 * 0.5 = 600
      // Margin: 1100 - 600 = 500 (45.45%)
      const result = await service.calculatePricing({
        seniority: SeniorityLevel.mid,
        isPartTime: true,
      });

      expect(result.grossClientPrice).toBe("1100.00");
      expect(result.talentPay).toBe("600.00");
      expect(result.grossMarginAmount).toBe("500.00");
      expect(result.grossMarginPct).toBe("45.45");
    });
  });

  describe("Buy-out Fee Calculation (CDC §5.5)", () => {
    it("calculates 3x multiplier for 0-6 months", async () => {
      const result = await service.calculateBuyout({
        monthlyClientPrice: "2000.00",
        monthsElapsed: 3,
      });

      expect(result.multiplier).toBe("3.00");
      expect(result.fee).toBe("6000.00");
    });

    it("calculates 2x multiplier for 6-12 months", async () => {
      const result = await service.calculateBuyout({
        monthlyClientPrice: "2000.00",
        monthsElapsed: 8,
      });

      expect(result.multiplier).toBe("2.00");
      expect(result.fee).toBe("4000.00");
    });

    it("calculates 1x multiplier for 12-24 months", async () => {
      const result = await service.calculateBuyout({
        monthlyClientPrice: "2000.00",
        monthsElapsed: 15,
      });

      expect(result.multiplier).toBe("1.00");
      expect(result.fee).toBe("2000.00");
    });

    it("calculates 0x multiplier (free) for 24+ months", async () => {
      const result = await service.calculateBuyout({
        monthlyClientPrice: "2000.00",
        monthsElapsed: 25,
      });

      expect(result.multiplier).toBe("0.00");
      expect(result.fee).toBe("0.00");
    });
  });
});

