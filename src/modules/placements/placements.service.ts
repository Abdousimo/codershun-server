import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  EngagementModel,
  PlacementStatus,
  Prisma,
  SeniorityLevel,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PricingService } from "../settings/pricing.service";
import { round2, toDecimal } from "../../common/utils/money";
import { CreatePlacementDto } from "./dto/create-placement.dto";
import { UpdatePlacementDto } from "./dto/update-placement.dto";
import { TransitionPlacementStatusDto } from "./dto/transition-status.dto";
import { QueryPlacementsDto } from "./dto/query-placements.dto";
import {
  AdminPlacementResponseDto,
  ClientPlacementResponseDto,
  TalentPlacementResponseDto,
} from "./dto/placement-response.dto";
import { PlacementOnboardingService } from "./placement-onboarding.service";

@Injectable()
export class PlacementsService {
  private readonly logger = new Logger(PlacementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly onboardingService: PlacementOnboardingService,
  ) {}

  /**
   * Generates a sequential reference code, e.g. PLC-2026-1042
   */
  private generateReference(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `PLC-${year}-${random}`;
  }

  private addWorkingDays(startDate: Date, workingDays: number): Date {
    const result = new Date(startDate);
    let remaining = workingDays;

    while (remaining > 0) {
      result.setUTCDate(result.getUTCDate() + 1);
      const day = result.getUTCDay();
      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }

    return result;
  }

  /**
   * Helper to verify talent capacity (FR-TAL-02: Total capacity <= 100%).
   */
  async verifyTalentCapacity(talentId: string, requestedSharePct: number, excludePlacementId?: string) {
    const activePlacements = await this.prisma.placements.findMany({
      where: {
        talentId,
        id: excludePlacementId ? { not: excludePlacementId } : undefined,
        status: {
          in: [
            PlacementStatus.pending_start,
            PlacementStatus.in_trial,
            PlacementStatus.active,
            PlacementStatus.notice,
          ],
        },
      },
      select: { timeSharePct: true },
    });

    const currentTotal = activePlacements.reduce((sum, p) => sum + p.timeSharePct, 0);
    if (currentTotal + requestedSharePct > 100) {
      throw new UnprocessableEntityException({
        code: "FR-TAL-02",
        message: `Talent total allocation would exceed 100% (currently ${currentTotal}%, requested ${requestedSharePct}%).`,
      });
    }
  }

  /**
   * Create a new placement (FR-PRICE-01..04, FR-TAL-02, FR-PLC-01).
   */
  async createPlacement(
    dto: CreatePlacementDto,
    currentUser: AuthenticatedUser,
  ): Promise<AdminPlacementResponseDto> {
    // 1. Capacity check (FR-TAL-02)
    await this.verifyTalentCapacity(dto.talentId, dto.timeSharePct);

    // 2. Discount limit check (FR-PRICE-04: max 12%)
    const discountPctNumber = dto.discountPct ?? 0;
    if (discountPctNumber > 12) {
      throw new UnprocessableEntityException({
        code: "FR-PRICE-04",
        message: "Discounts are capped at 12% combined (FR-PRICE-04).",
      });
    }

    // 3. Resolve talent pay and client price (FR-PRICE-01)
    const talentPay = toDecimal(dto.talentPay);
    let clientPrice: Prisma.Decimal;

    if (dto.clientPrice !== undefined && dto.clientPrice !== null) {
      clientPrice = toDecimal(dto.clientPrice);
    } else {
      const quote = await this.pricingService.calculatePricing({
        seniority: dto.seniority ?? SeniorityLevel.mid,
        talentNetPay: talentPay.toString(),
        targetMarginPct: dto.targetMarginPct ? dto.targetMarginPct.toString() : "40.00",
        isPartTime: dto.timeSharePct === 50,
      });
      clientPrice = toDecimal(quote.grossClientPrice);
    }

    // 4. Calculate Net Margin & Floor Margin Check (FR-PRICE-02: floor 25%)
    const discountPct = toDecimal(discountPctNumber);
    const hundred = new Prisma.Decimal(100);
    const netMultiplier = hundred.minus(discountPct).dividedBy(hundred);
    const clientPriceNet = clientPrice.times(netMultiplier);

    const marginAmount = clientPriceNet.minus(talentPay);
    const marginPct = clientPriceNet.isZero()
      ? new Prisma.Decimal(0)
      : marginAmount.dividedBy(clientPriceNet).times(hundred);

    const floorMarginPct = new Prisma.Decimal(25);

    // Margin below floor requires Super admin approval
    if (
      marginPct.lessThan(floorMarginPct) &&
      (!dto.marginOverrideApprovedBy ||
        currentUser.role !== UserRole.super_admin ||
        dto.marginOverrideApprovedBy !== currentUser.id)
    ) {
      throw new UnprocessableEntityException({
        code: "FR-PRICE-02",
        message: `Placement margin (${round2(marginPct).toString()}%) is below the 25% floor and requires Super admin approval.`,
      });
    }

    // 5. Resolve Legal Entity
    let legalEntityId = dto.legalEntityId;
    if (!legalEntityId) {
      const defaultEntity = await this.prisma.legalEntities.findFirst({
        where: { isActive: true },
      });
      if (defaultEntity) {
        legalEntityId = defaultEntity.id;
      } else {
        throw new BadRequestException("No active legal entity found for placement billing");
      }
    }

    // 6. Dates calculation (FR-PLC-01: 10 working days ~ 14 calendar days trial)
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const trialEndDate = this.addWorkingDays(startDate, 10);

    const reference = this.generateReference();

    // 7. Save placement inside withUserContext
    // NOTE: clientPriceNet, marginAmount, marginPct are generated computed columns (Rule 4)
    const created = await this.prisma.withUserContext(currentUser, async (tx) => {
      const placement = await tx.placements.create({
        data: {
          reference,
          companyId: dto.companyId,
          talentId: dto.talentId,
          requestId: dto.requestId,
          shortlistItemId: dto.shortlistItemId,
          legalEntityId,
          accountManagerId: dto.accountManagerId,
          clientManagerContactId: dto.clientManagerContactId,
          engagementModel: dto.engagementModel,
          jobRoleId: dto.jobRoleId,
          seniority: dto.seniority,
          timeSharePct: dto.timeSharePct,
          status: PlacementStatus.draft,
          startDate,
          trialEndDate,
          commitmentMonths: dto.commitmentMonths,
          plannedEndDate: dto.plannedEndDate ? new Date(dto.plannedEndDate) : null,
          currency: dto.currency ?? "EUR",
          talentPay,
          targetMarginPct: dto.targetMarginPct ? toDecimal(dto.targetMarginPct) : null,
          clientPrice,
          priceOverridden: dto.clientPrice !== undefined,
          discountPct,
          appliedDiscountCodes: dto.appliedDiscountCodes || [],
          floorMarginPct,
          marginOverrideApprovedBy: dto.marginOverrideApprovedBy,
          marginOverrideReason: dto.marginOverrideReason,
          marginOverrideApprovedAt: dto.marginOverrideApprovedBy ? new Date() : null,
          workCalendarId: dto.workCalendarId,
          clientToolsNotes: dto.clientToolsNotes,
          createdBy: currentUser.id,
        },
      });

      return placement;
    });

    // Seed onboarding checklist items
    await this.onboardingService.seedOnboardingChecklist(created.id, currentUser);

    return this.findAdminPlacementById(created.id);
  }

  /**
   * Update placement details (FR-PRICE-03: Prices frozen once signed/non-draft unless Super admin).
   */
  async updatePlacement(
    id: string,
    dto: UpdatePlacementDto,
    currentUser: AuthenticatedUser,
  ): Promise<AdminPlacementResponseDto> {
    const existing = await this.prisma.placements.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Placement ${id} not found`);
    }

    // FR-PRICE-03: Prices frozen once placement leaves draft
    if (existing.status !== PlacementStatus.draft) {
      const isPriceModified =
        dto.clientPrice !== undefined ||
        dto.talentPay !== undefined ||
        dto.discountPct !== undefined ||
        dto.currency !== undefined;

      if (isPriceModified && currentUser.role !== UserRole.super_admin) {
        throw new ForbiddenException(
          "Prices of a signed placement can only be changed by a Super admin (amendment)",
        );
      }
    }

    // Capacity re-check if timeSharePct changed
    if (dto.timeSharePct !== undefined && dto.timeSharePct !== existing.timeSharePct) {
      await this.verifyTalentCapacity(existing.talentId, dto.timeSharePct, existing.id);
    }

    // Discount check if updated
    if (dto.discountPct !== undefined && dto.discountPct > 12) {
      throw new UnprocessableEntityException({
        code: "FR-PRICE-04",
        message: "Discounts are capped at 12% combined (FR-PRICE-04).",
      });
    }

    const data: Prisma.PlacementsUpdateInput = {};

    if (dto.jobRoleId !== undefined) data.jobRoleId = dto.jobRoleId;
    if (dto.seniority !== undefined) data.seniority = dto.seniority;
    if (dto.timeSharePct !== undefined) data.timeSharePct = dto.timeSharePct;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.plannedEndDate !== undefined) data.plannedEndDate = dto.plannedEndDate ? new Date(dto.plannedEndDate) : null;
    if (dto.accountManagerId !== undefined) data.accountManagerId = dto.accountManagerId;
    if (dto.clientManagerContactId !== undefined) data.clientManagerContactId = dto.clientManagerContactId;
    if (dto.clientToolsNotes !== undefined) data.clientToolsNotes = dto.clientToolsNotes;

    if (dto.talentPay !== undefined) data.talentPay = toDecimal(dto.talentPay);
    if (dto.clientPrice !== undefined) data.clientPrice = toDecimal(dto.clientPrice);
    if (dto.discountPct !== undefined) data.discountPct = toDecimal(dto.discountPct);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.appliedDiscountCodes !== undefined) data.appliedDiscountCodes = dto.appliedDiscountCodes;

    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.placements.update({
        where: { id },
        data,
      });
    });

    return this.findAdminPlacementById(id);
  }

  /**
   * Transition placement status using allowed state transitions table.
   */
  async transitionStatus(
    id: string,
    dto: TransitionPlacementStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<AdminPlacementResponseDto> {
    const existing = await this.prisma.placements.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Placement ${id} not found`);
    }

    // Check allowed transition
    const allowed = await this.prisma.placementStatusTransitions.findUnique({
      where: {
        fromStatus_toStatus: {
          fromStatus: existing.status,
          toStatus: dto.status,
        },
      },
    });

    if (!allowed) {
      throw new BadRequestException(
        `Placement ${existing.reference} cannot move from status '${existing.status}' to '${dto.status}'`,
      );
    }

    // If moving to active or in_trial, ensure capacity
    if (dto.status === PlacementStatus.in_trial || dto.status === PlacementStatus.active) {
      await this.verifyTalentCapacity(existing.talentId, existing.timeSharePct, existing.id);
    }

    const transitionData: Prisma.PlacementsUpdateInput = {
      status: dto.status,
      endReason: dto.reason || existing.endReason,
    };

    if (dto.status === PlacementStatus.in_trial) {
      const startDate = existing.startDate ?? new Date();
      transitionData.startDate = startDate;
      transitionData.trialEndDate = existing.trialEndDate ?? this.addWorkingDays(startDate, 10);
    }

    if (
      dto.status === PlacementStatus.ended ||
      dto.status === PlacementStatus.ended_in_trial ||
      dto.status === PlacementStatus.cancelled ||
      dto.status === PlacementStatus.bought_out
    ) {
      transitionData.endDate = existing.endDate ?? new Date();
    }

    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.placements.update({
        where: { id },
        data: transitionData,
      });
    });

    return this.findAdminPlacementById(id);
  }

  /**
   * List placements with filters, search, and pagination.
   */
  async findAll(query: QueryPlacementsDto, currentUser: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PlacementsWhereInput = {};

    if (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) {
      if (!currentUser.companyId) {
        throw new ForbiddenException("Client user has no associated company");
      }
      where.companyId = currentUser.companyId;
    } else if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (currentUser.role === UserRole.talent) {
      if (!currentUser.talentId) {
        throw new ForbiddenException("Talent user has no associated talent profile");
      }
      where.talentId = currentUser.talentId;
    } else if (query.talentId) {
      where.talentId = query.talentId;
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.accountManagerId) {
      where.accountManagerId = query.accountManagerId;
    }
    if (query.isAtRisk !== undefined) {
      where.isAtRisk = query.isAtRisk;
    }

    if (query.search) {
      where.OR = [
        { reference: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [total, placements] = await Promise.all([
      this.prisma.placements.count({ where }),
      this.prisma.placements.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Role-dependent projection (FR-SEC-02)
    const data = await Promise.all(
      placements.map(async (p) => {
        if (currentUser.role === UserRole.talent) {
          return this.mapToTalentPlacement(p);
        } else if (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) {
          return this.mapToClientPlacement(p);
        }
        return this.mapToAdminPlacement(p);
      }),
    );

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }

  /**
   * Find placement by ID.
   */
  async findById(id: string, currentUser: AuthenticatedUser) {
    const placement = await this.prisma.placements.findUnique({
      where: { id },
    });
    if (!placement) {
      throw new NotFoundException(`Placement ${id} not found`);
    }

    if (
      (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) &&
      placement.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException("Access to this placement is denied");
    }

    if (currentUser.role === UserRole.talent && placement.talentId !== currentUser.talentId) {
      throw new ForbiddenException("Access to this placement is denied");
    }

    if (currentUser.role === UserRole.talent) {
      return this.mapToTalentPlacement(placement);
    } else if (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) {
      return this.mapToClientPlacement(placement);
    }

    return this.mapToAdminPlacement(placement);
  }

  /**
   * Direct admin query helper.
   */
  async findAdminPlacementById(id: string): Promise<AdminPlacementResponseDto> {
    const placement = await this.prisma.placements.findUnique({
      where: { id },
    });
    if (!placement) {
      throw new NotFoundException(`Placement ${id} not found`);
    }
    return this.mapToAdminPlacement(placement);
  }

  /**
   * Internal mapper for Admin Response.
   */
  private async mapToAdminPlacement(placement: any): Promise<AdminPlacementResponseDto> {
    const [company, talent, onboardingItems] = await Promise.all([
      this.prisma.companies.findUnique({ where: { id: placement.companyId }, select: { name: true } }),
      this.prisma.talents.findUnique({
        where: { id: placement.talentId },
        select: { firstName: true, lastName: true, email: true },
      }),
      this.onboardingService.getOnboardingItems(placement.id),
    ]);

    // Computed margin values
    const talentPay = toDecimal(placement.talentPay);
    const clientPrice = toDecimal(placement.clientPrice);
    const discountPct = toDecimal(placement.discountPct);
    const hundred = new Prisma.Decimal(100);
    const clientPriceNet = clientPrice.times(hundred.minus(discountPct)).dividedBy(hundred);
    const marginAmount = clientPriceNet.minus(talentPay);
    const marginPct = clientPriceNet.isZero()
      ? new Prisma.Decimal(0)
      : marginAmount.dividedBy(clientPriceNet).times(hundred);

    const marginWarning = marginPct.lessThan(new Prisma.Decimal(30));

    return {
      id: placement.id,
      reference: placement.reference,
      companyId: placement.companyId,
      companyName: company?.name,
      talentId: placement.talentId,
      talentName: talent ? `${talent.firstName} ${talent.lastName}` : "Unknown",
      talentEmail: talent?.email,
      requestId: placement.requestId,
      engagementModel: placement.engagementModel,
      seniority: placement.seniority,
      timeSharePct: placement.timeSharePct,
      status: placement.status,
      startDate: placement.startDate ? placement.startDate.toISOString().split("T")[0] : null,
      trialEndDate: placement.trialEndDate ? placement.trialEndDate.toISOString().split("T")[0] : null,
      trialDecision: placement.trialDecision,
      plannedEndDate: placement.plannedEndDate ? placement.plannedEndDate.toISOString().split("T")[0] : null,
      endDate: placement.endDate ? placement.endDate.toISOString().split("T")[0] : null,
      renewalDate: placement.renewalDate ? placement.renewalDate.toISOString().split("T")[0] : null,
      noticeGivenAt: placement.noticeGivenAt ? placement.noticeGivenAt.toISOString().split("T")[0] : null,
      noticeGivenBy: placement.noticeGivenBy,
      noticePeriodDays: placement.noticePeriodDays,
      noticeEndDate: placement.noticeEndDate ? placement.noticeEndDate.toISOString().split("T")[0] : null,
      endReason: placement.endReason,
      currency: placement.currency,
      talentPay: talentPay.toFixed(2),
      clientPrice: clientPrice.toFixed(2),
      discountPct: discountPct.toFixed(2),
      clientPriceNet: clientPriceNet.toFixed(2),
      marginAmount: marginAmount.toFixed(2),
      marginPct: marginPct.toFixed(2),
      floorMarginPct: toDecimal(placement.floorMarginPct).toFixed(2),
      marginWarning,
      marginOverrideApprovedBy: placement.marginOverrideApprovedBy,
      marginOverrideReason: placement.marginOverrideReason,
      isAtRisk: placement.isAtRisk,
      onboardingItems: onboardingItems.map((o) => ({
        id: o.id,
        code: o.code,
        label: o.label,
        ownerSide: o.ownerSide,
        isDone: o.isDone,
        doneAt: o.doneAt ? o.doneAt.toISOString() : null,
      })),
      createdAt: placement.createdAt.toISOString(),
      updatedAt: placement.updatedAt.toISOString(),
    };
  }

  /**
   * Internal mapper for Client Response (FR-SEC-02: hides talent pay & margins).
   */
  private async mapToClientPlacement(placement: any): Promise<ClientPlacementResponseDto> {
    const [talent, accountManager, onboardingItems] = await Promise.all([
      this.prisma.talents.findUnique({
        where: { id: placement.talentId },
        select: { publicSlug: true, headline: true },
      }),
      placement.accountManagerId
        ? this.prisma.users.findUnique({
            where: { id: placement.accountManagerId },
            select: { firstName: true, lastName: true, email: true },
          })
        : null,
      this.onboardingService.getOnboardingItems(placement.id),
    ]);

    const clientPrice = toDecimal(placement.clientPrice);
    const discountPct = toDecimal(placement.discountPct);
    const hundred = new Prisma.Decimal(100);
    const clientPriceNet = clientPrice.times(hundred.minus(discountPct)).dividedBy(hundred);

    return {
      id: placement.id,
      reference: placement.reference,
      talentPublicSlug: talent?.publicSlug || `talent-${placement.talentId.slice(0, 8)}`,
      talentHeadline: talent?.headline,
      seniority: placement.seniority,
      engagementModel: placement.engagementModel,
      timeSharePct: placement.timeSharePct,
      status: placement.status,
      startDate: placement.startDate ? placement.startDate.toISOString().split("T")[0] : null,
      trialEndDate: placement.trialEndDate ? placement.trialEndDate.toISOString().split("T")[0] : null,
      trialDecision: placement.trialDecision,
      plannedEndDate: placement.plannedEndDate ? placement.plannedEndDate.toISOString().split("T")[0] : null,
      noticeEndDate: placement.noticeEndDate ? placement.noticeEndDate.toISOString().split("T")[0] : null,
      currency: placement.currency,
      clientPrice: clientPrice.toFixed(2),
      discountPct: discountPct.toFixed(2),
      clientPriceNet: clientPriceNet.toFixed(2),
      accountManagerName: accountManager ? `${accountManager.firstName} ${accountManager.lastName}`.trim() : null,
      accountManagerEmail: accountManager?.email,
      onboardingItems: onboardingItems.map((o) => ({
        id: o.id,
        code: o.code,
        label: o.label,
        ownerSide: o.ownerSide,
        isDone: o.isDone,
        doneAt: o.doneAt ? o.doneAt.toISOString() : null,
      })),
      createdAt: placement.createdAt.toISOString(),
    };
  }

  /**
   * Internal mapper for Talent Response (FR-SEC-02: hides client price, discounts, margins).
   */
  private async mapToTalentPlacement(placement: any): Promise<TalentPlacementResponseDto> {
    const [company, onboardingItems] = await Promise.all([
      this.prisma.companies.findUnique({
        where: { id: placement.companyId },
        select: { name: true },
      }),
      this.onboardingService.getOnboardingItems(placement.id),
    ]);

    return {
      id: placement.id,
      reference: placement.reference,
      companyName: company?.name || "Client Company",
      seniority: placement.seniority,
      engagementModel: placement.engagementModel,
      timeSharePct: placement.timeSharePct,
      status: placement.status,
      startDate: placement.startDate ? placement.startDate.toISOString().split("T")[0] : null,
      trialEndDate: placement.trialEndDate ? placement.trialEndDate.toISOString().split("T")[0] : null,
      currency: placement.currency,
      talentPay: toDecimal(placement.talentPay).toFixed(2),
      onboardingItems: onboardingItems.map((o) => ({
        id: o.id,
        code: o.code,
        label: o.label,
        ownerSide: o.ownerSide,
        isDone: o.isDone,
        doneAt: o.doneAt ? o.doneAt.toISOString() : null,
      })),
      createdAt: placement.createdAt.toISOString(),
    };
  }
}
