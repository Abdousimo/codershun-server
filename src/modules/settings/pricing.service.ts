import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { Prisma, SeniorityLevel } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { round2, toDecimal } from "../../common/utils/money";
import {
  CalculateBuyoutDto,
  CalculatePricingDto,
} from "./dto/calculate-pricing.dto";
import {
  AppliedDiscountDto,
  BuyoutResultDto,
  PricingResultDto,
} from "./dto/pricing-result.dto";

export interface RateCardVersionSnapshot {
  id: string;
  hoursPerMonth: Prisma.Decimal;
  tmPremiumPct: Prisma.Decimal;
  hoursPerDay: Prisma.Decimal;
  partTimePricePct: Prisma.Decimal;
  floorMarginPct: Prisma.Decimal;
  warningMarginPct: Prisma.Decimal;
  maxCombinedDiscountPct: Prisma.Decimal;
  entries: {
    seniority: SeniorityLevel;
    talentNetPay: Prisma.Decimal;
    targetMarginPct: Prisma.Decimal;
  }[];
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  // CDC §5.2 canonical defaults
  private readonly DEFAULT_ENTRIES: Record<SeniorityLevel, { pay: string; margin: string }> = {
    [SeniorityLevel.junior]: { pay: "700.00", margin: "44.00" },
    [SeniorityLevel.mid]: { pay: "1200.00", margin: "40.00" },
    [SeniorityLevel.senior]: { pay: "2000.00", margin: "37.50" },
    [SeniorityLevel.lead]: { pay: "2800.00", margin: "35.00" },
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the current active rate card version with its entries.
   */
  async getCurrentRateCardVersion() {
    const version = await this.prisma.rateCardVersions.findFirst({
      where: { isCurrent: true },
      orderBy: { validFrom: "desc" },
    });

    if (!version) {
      return null;
    }

    const entries = await this.prisma.rateCardEntries.findMany({
      where: { rateCardVersionId: version.id },
    });

    return { ...version, entries };
  }

  /**
   * Retrieves a specific rate card version by ID.
   * FR-PRICE-03: Rate card snapshot preservation.
   */
  async getRateCardVersionById(id: string) {
    const version = await this.prisma.rateCardVersions.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException(`Rate card version ${id} not found`);
    }

    const entries = await this.prisma.rateCardEntries.findMany({
      where: { rateCardVersionId: version.id },
    });

    return { ...version, entries };
  }

  /**
   * Calculates pricing for a placement or quote.
   * Enforces:
   *  - FR-PRICE-01: Client price = talent pay / (1 - margin), manual override recomputes margin
   *  - FR-PRICE-03: Versioned rate card snapshot
   *  - FR-PRICE-04: Discounts capped at max (12%), never reduce talent pay, margin warning & floor checks
   */
  async calculatePricing(dto: CalculatePricingDto): Promise<PricingResultDto> {
    const one = new Prisma.Decimal(1);
    const hundred = new Prisma.Decimal(100);

    // 1. Resolve rate card version (FR-PRICE-03)
    let versionId = dto.rateCardVersionId;
    let hoursPerMonth = toDecimal("160.00");
    let tmPremiumPct = toDecimal("15.00");
    let hoursPerDay = toDecimal("8.00");
    let partTimePricePct = toDecimal("55.00");
    let floorMarginPct = toDecimal("25.00");
    let warningMarginPct = toDecimal("30.00");
    let maxCombinedDiscountPct = toDecimal("12.00");
    let rateCardEntries: { seniority: SeniorityLevel; talentNetPay: Prisma.Decimal; targetMarginPct: Prisma.Decimal }[] = [];

    if (versionId) {
      const version = await this.getRateCardVersionById(versionId);
      hoursPerMonth = version.hoursPerMonth;
      tmPremiumPct = version.tmPremiumPct;
      hoursPerDay = version.hoursPerDay;
      partTimePricePct = version.partTimePricePct;
      floorMarginPct = version.floorMarginPct;
      warningMarginPct = version.warningMarginPct;
      maxCombinedDiscountPct = version.maxCombinedDiscountPct;
      rateCardEntries = version.entries;
    } else {
      const currentVersion = await this.getCurrentRateCardVersion();
      if (currentVersion) {
        versionId = currentVersion.id;
        hoursPerMonth = currentVersion.hoursPerMonth;
        tmPremiumPct = currentVersion.tmPremiumPct;
        hoursPerDay = currentVersion.hoursPerDay;
        partTimePricePct = currentVersion.partTimePricePct;
        floorMarginPct = currentVersion.floorMarginPct;
        warningMarginPct = currentVersion.warningMarginPct;
        maxCombinedDiscountPct = currentVersion.maxCombinedDiscountPct;
        rateCardEntries = currentVersion.entries;
      } else {
        versionId = "default";
      }
    }

    // 2. Resolve base talent pay and target margin
    let basePay: Prisma.Decimal;
    let targetMargin: Prisma.Decimal;

    if (dto.talentNetPay) {
      basePay = toDecimal(dto.talentNetPay);
      targetMargin = dto.targetMarginPct ? toDecimal(dto.targetMarginPct) : toDecimal("40.00");
    } else if (dto.seniority) {
      const entry = rateCardEntries.find((e) => e.seniority === dto.seniority);
      if (entry) {
        basePay = entry.talentNetPay;
        targetMargin = dto.targetMarginPct ? toDecimal(dto.targetMarginPct) : entry.targetMarginPct;
      } else {
        const canonical = this.DEFAULT_ENTRIES[dto.seniority];
        basePay = toDecimal(canonical.pay);
        targetMargin = dto.targetMarginPct ? toDecimal(dto.targetMarginPct) : toDecimal(canonical.margin);
      }
    } else {
      throw new BadRequestException("Either seniority or talentNetPay must be provided");
    }

    // 3. Rare skill premium (+10-20% on both sides)
    let effectiveTalentPay = basePay;
    if (dto.skillPremiumPct) {
      const skillPremium = toDecimal(dto.skillPremiumPct).dividedBy(hundred);
      effectiveTalentPay = effectiveTalentPay.times(one.plus(skillPremium));
    }

    // 4. Calculate Gross Client Price (FR-PRICE-01)
    let grossClientPrice: Prisma.Decimal;
    let grossMarginAmount: Prisma.Decimal;
    let grossMarginPct: Prisma.Decimal;

    if (dto.overrideClientPrice) {
      // Manual override: client price is fixed, margin is recalculated live
      grossClientPrice = toDecimal(dto.overrideClientPrice);
      if (grossClientPrice.isZero()) {
        throw new BadRequestException("Client price cannot be zero");
      }
      grossMarginAmount = grossClientPrice.minus(effectiveTalentPay);
      grossMarginPct = grossMarginAmount.dividedBy(grossClientPrice).times(hundred);
    } else {
      // Standard formula: client_price = talent_pay / (1 - margin)
      const marginRatio = targetMargin.dividedBy(hundred);
      if (marginRatio.greaterThanOrEqualTo(one)) {
        throw new BadRequestException("Target margin must be less than 100%");
      }
      grossClientPrice = effectiveTalentPay.dividedBy(one.minus(marginRatio));
      grossMarginAmount = grossClientPrice.minus(effectiveTalentPay);
      grossMarginPct = targetMargin;
    }

    // 5. Part-time adjustment (50% workload = 55% of full-time price)
    if (dto.isPartTime) {
      const ptRatio = partTimePricePct.dividedBy(hundred);
      grossClientPrice = grossClientPrice.times(ptRatio);
      effectiveTalentPay = effectiveTalentPay.times(new Prisma.Decimal("0.5"));
      grossMarginAmount = grossClientPrice.minus(effectiveTalentPay);
      grossMarginPct = grossClientPrice.isZero()
        ? new Prisma.Decimal(0)
        : grossMarginAmount.dividedBy(grossClientPrice).times(hundred);
    }

    // 6. Discounts & Capping (FR-PRICE-04)
    const appliedDiscounts: AppliedDiscountDto[] = [];
    let combinedDiscountPct = new Prisma.Decimal(0);

    // Look up discount rules from DB
    const discountRules = await this.prisma.discountRules.findMany({
      where: { isActive: true },
    });

    // Check specific discount codes requested
    if (dto.discountCodes && dto.discountCodes.length > 0) {
      for (const code of dto.discountCodes) {
        const rule = discountRules.find((r) => r.code === code);
        if (rule) {
          appliedDiscounts.push({
            code: rule.code,
            label: rule.label,
            discountPct: rule.discountPct.toString(),
          });
          combinedDiscountPct = combinedDiscountPct.plus(rule.discountPct);
        }
      }
    } else {
      // Auto-apply based on numTalents and commitmentMonths if codes not explicitly given
      if (dto.numTalents && dto.numTalents >= 3) {
        const teamRule = discountRules.find((r) => r.minTalents && dto.numTalents! >= r.minTalents);
        if (teamRule) {
          appliedDiscounts.push({
            code: teamRule.code,
            label: teamRule.label,
            discountPct: teamRule.discountPct.toString(),
          });
          combinedDiscountPct = combinedDiscountPct.plus(teamRule.discountPct);
        } else {
          // Default fallback team discount (5%)
          appliedDiscounts.push({
            code: "team_3_plus",
            label: "Team of 3+ talents",
            discountPct: "5.00",
          });
          combinedDiscountPct = combinedDiscountPct.plus(new Prisma.Decimal("5.00"));
        }
      }

      if (dto.commitmentMonths) {
        if (dto.commitmentMonths >= 12) {
          const annualRule = discountRules.find((r) => r.minCommitmentMonths === 12);
          if (annualRule) {
            appliedDiscounts.push({
              code: annualRule.code,
              label: annualRule.label,
              discountPct: annualRule.discountPct.toString(),
            });
            combinedDiscountPct = combinedDiscountPct.plus(annualRule.discountPct);
          } else {
            appliedDiscounts.push({
              code: "annual_12m",
              label: "12-month commitment",
              discountPct: "10.00",
            });
            combinedDiscountPct = combinedDiscountPct.plus(new Prisma.Decimal("10.00"));
          }
        } else if (dto.commitmentMonths >= 6) {
          const sixMRule = discountRules.find((r) => r.minCommitmentMonths === 6);
          if (sixMRule) {
            appliedDiscounts.push({
              code: sixMRule.code,
              label: sixMRule.label,
              discountPct: sixMRule.discountPct.toString(),
            });
            combinedDiscountPct = combinedDiscountPct.plus(sixMRule.discountPct);
          } else {
            appliedDiscounts.push({
              code: "commitment_6m",
              label: "6-month commitment",
              discountPct: "5.00",
            });
            combinedDiscountPct = combinedDiscountPct.plus(new Prisma.Decimal("5.00"));
          }
        }
      }
    }

    if (dto.customDiscountPct) {
      const customPct = toDecimal(dto.customDiscountPct);
      appliedDiscounts.push({
        code: "custom",
        label: "Custom discount",
        discountPct: customPct.toString(),
      });
      combinedDiscountPct = combinedDiscountPct.plus(customPct);
    }

    // Cap at maxCombinedDiscountPct (default 12%)
    const effectiveDiscountPct = Prisma.Decimal.min(combinedDiscountPct, maxCombinedDiscountPct);

    // Discount reduces client price, absorbed completely by agency margin (talent pay NEVER reduced)
    const discountAmount = grossClientPrice.times(effectiveDiscountPct.dividedBy(hundred));
    const netClientPrice = grossClientPrice.minus(discountAmount);
    const netMarginAmount = netClientPrice.minus(effectiveTalentPay);
    const netMarginPct = netClientPrice.isZero()
      ? new Prisma.Decimal(0)
      : netMarginAmount.dividedBy(netClientPrice).times(hundred);

    // Warning and floor margin checks
    const isUnderWarningMargin = netMarginPct.lessThan(warningMarginPct);
    const isUnderFloorMargin = netMarginPct.lessThan(floorMarginPct);

    // 7. Time & Material Rates (Flexibility premium: default 15%)
    // Hourly rate = grossClientPrice / hoursPerMonth * (1 + tmPremiumPct / 100)
    // Daily rate = hourlyRate * hoursPerDay
    const hourlyBase = grossClientPrice.dividedBy(hoursPerMonth);
    const tmRatio = tmPremiumPct.dividedBy(hundred);
    const hourlyRate = hourlyBase.times(one.plus(tmRatio));
    const dailyRate = hourlyRate.times(hoursPerDay);

    // Talent daily equivalent pay (basePay / (hoursPerMonth / hoursPerDay))
    const workingDaysPerMonth = hoursPerMonth.dividedBy(hoursPerDay);
    const talentDailyPay = workingDaysPerMonth.isZero()
      ? new Prisma.Decimal(0)
      : effectiveTalentPay.dividedBy(workingDaysPerMonth);

    return {
      rateCardVersionId: versionId,
      talentPay: round2(effectiveTalentPay).toFixed(2),
      grossClientPrice: round2(grossClientPrice).toFixed(2),
      discountPct: round2(effectiveDiscountPct).toFixed(2),
      discountAmount: round2(discountAmount).toFixed(2),
      netClientPrice: round2(netClientPrice).toFixed(2),
      grossMarginAmount: round2(grossMarginAmount).toFixed(2),
      grossMarginPct: round2(grossMarginPct).toFixed(2),
      netMarginAmount: round2(netMarginAmount).toFixed(2),
      netMarginPct: round2(netMarginPct).toFixed(2),
      hourlyRate: round2(hourlyRate).toFixed(2),
      dailyRate: round2(dailyRate).toFixed(2),
      talentDailyPay: round2(talentDailyPay).toFixed(2),
      isUnderWarningMargin,
      isUnderFloorMargin,
      appliedDiscounts,
    };
  }

  /**
   * Calculates Buy-out Fee based on placement start duration.
   * CDC §5.5:
   * 0-6 months: 3 x monthly client price
   * 6-12 months: 2 x monthly client price
   * 12-24 months: 1 x monthly client price
   * 24+ months: 0
   */
  async calculateBuyout(dto: CalculateBuyoutDto): Promise<BuyoutResultDto> {
    const monthlyPrice = toDecimal(dto.monthlyClientPrice);
    const months = dto.monthsElapsed;

    const tiers = await this.prisma.buyoutTiers.findMany({
      where: { isActive: true },
      orderBy: { fromMonth: "asc" },
    });

    let matchedMultiplier = new Prisma.Decimal(0);

    if (tiers.length > 0) {
      const match = tiers.find((tier) => {
        if (tier.toMonth === null) {
          return months >= tier.fromMonth;
        }
        return months >= tier.fromMonth && months < tier.toMonth;
      });
      if (match) {
        matchedMultiplier = match.multiplier;
      }
    } else {
      // Default fallback according to CDC §5.5
      if (months < 6) {
        matchedMultiplier = new Prisma.Decimal("3.00");
      } else if (months < 12) {
        matchedMultiplier = new Prisma.Decimal("2.00");
      } else if (months < 24) {
        matchedMultiplier = new Prisma.Decimal("1.00");
      } else {
        matchedMultiplier = new Prisma.Decimal("0.00");
      }
    }

    const fee = monthlyPrice.times(matchedMultiplier);

    return {
      monthsElapsed: months,
      multiplier: matchedMultiplier.toFixed(2),
      fee: round2(fee).toFixed(2),
    };
  }
}

