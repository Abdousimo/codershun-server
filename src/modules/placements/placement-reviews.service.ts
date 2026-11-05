import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  EngagementModel,
  PlacementStatus,
  Prisma,
  RequestStatus,
  RiskFlagSource,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { toDecimal } from "../../common/utils/money";
import { TrialDecisionDto } from "./dto/trial-decision.dto";
import { GiveNoticeDto } from "./dto/give-notice.dto";
import { CreateBuyoutQuoteDto } from "./dto/create-buyout-quote.dto";
import { CreateCheckInDto } from "./dto/check-in.dto";

@Injectable()
export class PlacementReviewsService {
  private readonly logger = new Logger(PlacementReviewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record Keep or Replace decision at end of trial (FR-PLC-01, FR-PLC-02, FR-PLC-03).
   */
  async recordTrialDecision(
    placementId: string,
    dto: TrialDecisionDto,
    currentUser: AuthenticatedUser,
  ) {
    const placement = await this.prisma.placements.findUnique({
      where: { id: placementId },
    });

    if (!placement) {
      throw new NotFoundException(`Placement ${placementId} not found`);
    }

    if (
      (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) &&
      placement.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException("Access to this placement is denied");
    }

    if (placement.status !== PlacementStatus.in_trial) {
      throw new BadRequestException(`Cannot record trial decision for placement in status '${placement.status}'`);
    }

    const now = new Date();

    return this.prisma.withUserContext(currentUser, async (tx) => {
      if (dto.decision === "keep") {
        // FR-PLC-01: Keep -> Active
        return tx.placements.update({
          where: { id: placementId },
          data: {
            status: PlacementStatus.active,
            trialDecision: "keep",
            trialDecisionAt: now,
          },
        });
      }

      // FR-PLC-02: Replace -> ended_in_trial, days not billed, trial loss logged, replacement request created
      const daysWorked = new Prisma.Decimal(10);
      const monthlyPay = toDecimal(placement.talentPay);
      const talentDailyPay = monthlyPay.dividedBy(new Prisma.Decimal(20)); // ~20 working days per month
      const trialTalentCost = talentDailyPay.times(daysWorked);

      // Check if within free replacement window (FR-PLC-03: free within 3 months)
      let isFreeReplacement = true;
      if (placement.startDate) {
        const monthsElapsed = (now.getTime() - new Date(placement.startDate).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsElapsed > 3) {
          isFreeReplacement = false;
        }
      }

      // Create replacement talent request
      const replacementRequest = await tx.talentRequests.create({
        data: {
          companyId: placement.companyId,
          engagementModel: placement.engagementModel,
          roleTitle: `Replacement for ${placement.reference}`,
          seniority: placement.seniority,
          timeSharePct: placement.timeSharePct,
          budgetCurrency: placement.currency,
          status: RequestStatus.open,
          replacesPlacementId: placement.id,
          description: `Automatic replacement request from trial end (${dto.reason || "Trial ended with replace"}).`,
          createdBy: currentUser.id,
        },
      });

      // Record trial loss
      await tx.trialLosses.create({
        data: {
          placementId,
          daysWorked,
          talentCost: trialTalentCost,
          currency: placement.currency,
          replacementRequestId: replacementRequest.id,
        },
      });

      return tx.placements.update({
        where: { id: placementId },
        data: {
          status: PlacementStatus.ended_in_trial,
          trialDecision: "replace",
          trialDecisionAt: now,
          endReason: dto.reason || "Ended in trial - replace",
          endDate: now,
          replacedByPlacementId: null, // Will be linked when replacement placement is created
          isFreeReplacement,
        },
      });
    });
  }

  /**
   * Initiate notice period (FR-PLC-01).
   */
  async giveNotice(
    placementId: string,
    dto: GiveNoticeDto,
    currentUser: AuthenticatedUser,
  ) {
    const placement = await this.prisma.placements.findUnique({
      where: { id: placementId },
    });

    if (!placement) {
      throw new NotFoundException(`Placement ${placementId} not found`);
    }

    if (
      (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) &&
      placement.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException("Access to this placement is denied");
    }

    if (placement.status !== PlacementStatus.active) {
      throw new BadRequestException(`Cannot give notice for placement in status '${placement.status}'`);
    }

    const noticeDate = dto.noticeDate ? new Date(dto.noticeDate) : new Date();
    const noticePeriodDays = dto.noticePeriodDays || 30;
    const noticeEndDate = new Date(noticeDate.getTime() + noticePeriodDays * 24 * 60 * 60 * 1000);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.placements.update({
        where: { id: placementId },
        data: {
          status: PlacementStatus.notice,
          noticeGivenAt: noticeDate,
          noticeGivenBy: dto.noticeParty,
          noticePeriodDays,
          noticeEndDate,
          endReason: dto.endReason,
        },
      });
    });
  }

  /**
   * Generate buyout quote based on buyout_tiers (FR-PLC-04).
   */
  async createBuyoutQuote(
    placementId: string,
    dto: CreateBuyoutQuoteDto,
    currentUser: AuthenticatedUser,
  ) {
    const placement = await this.prisma.placements.findUnique({
      where: { id: placementId },
    });

    if (!placement) {
      throw new NotFoundException(`Placement ${placementId} not found`);
    }

    // Determine months elapsed
    let months = dto.monthsSinceStart;
    if (months === undefined) {
      const start = placement.startDate ? new Date(placement.startDate) : new Date(placement.createdAt);
      const diffMs = Date.now() - start.getTime();
      months = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30)));
    }

    // Lookup buyout tier
    const tiers = await this.prisma.buyoutTiers.findMany({
      where: { isActive: true },
      orderBy: { fromMonth: "asc" },
    });

    let matchedTier = tiers.find(
      (t) => months >= t.fromMonth && (t.toMonth === null || months < t.toMonth),
    );

    let multiplier = new Prisma.Decimal("3.0");
    let buyoutTierId: string | null = null;

    if (matchedTier) {
      multiplier = matchedTier.multiplier;
      buyoutTierId = matchedTier.id;
    } else if (tiers.length > 0) {
      const lastTier = tiers[tiers.length - 1];
      if (months >= (lastTier.toMonth ?? lastTier.fromMonth)) {
        multiplier = lastTier.multiplier;
        buyoutTierId = lastTier.id;
      }
    } else if (months >= 24) {
      multiplier = new Prisma.Decimal("0.0");
    }

    const monthlyClientPrice = toDecimal(placement.clientPrice);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.buyoutQuotes.create({
        data: {
          placementId,
          monthsSinceStart: months,
          buyoutTierId,
          multiplier,
          monthlyClientPrice,
          currency: placement.currency,
          requestedBy: currentUser.id,
          status: "quoted",
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days valid
        },
      });
    });
  }

  /**
   * Record periodic check-in score (1 to 5) and auto-flag risk if score <= 2.
   */
  async recordCheckIn(
    placementId: string,
    dto: CreateCheckInDto,
    currentUser: AuthenticatedUser,
  ) {
    const placement = await this.prisma.placements.findUnique({
      where: { id: placementId },
    });

    if (!placement) {
      throw new NotFoundException(`Placement ${placementId} not found`);
    }

    const periodStart = dto.periodStart
      ? new Date(dto.periodStart)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const checkIn = await tx.checkIns.upsert({
        where: {
          placementId_type_periodStart: {
            placementId,
            type: dto.type,
            periodStart,
          },
        },
        create: {
          placementId,
          type: dto.type,
          periodStart,
          respondentUserId: currentUser.id,
          score: dto.score,
          comment: dto.comment,
          submittedAt: new Date(),
        },
        update: {
          score: dto.score,
          comment: dto.comment,
          respondentUserId: currentUser.id,
          submittedAt: new Date(),
        },
      });

      // Low check-in score (score <= 2) triggers risk flag
      if (dto.score <= 2) {
        await tx.placements.update({
          where: { id: placementId },
          data: { isAtRisk: true },
        });

        await tx.riskFlags.create({
          data: {
            placementId,
            companyId: placement.companyId,
            checkInId: checkIn.id,
            source: RiskFlagSource.low_checkin,
            description: `Check-in score ${dto.score}/5 on placement ${placement.reference}: ${dto.comment || "No comment"}`,
            assignedTo: placement.accountManagerId,
          },
        });
      }

      return checkIn;
    });
  }
}

