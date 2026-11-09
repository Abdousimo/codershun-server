import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  InvoiceStatus,
  Prisma,
  RequestStatus,
  SeniorityLevel,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PricingService } from "../settings/pricing.service";
import { SettingsService } from "../settings/settings.service";
import { toDecimal } from "../../common/utils/money";
import { CreateTalentRequestDto } from "./dto/create-talent-request.dto";
import { QueryTalentRequestsDto } from "./dto/query-talent-requests.dto";
import {
  TalentRequestResponseDto,
} from "./dto/talent-request-response.dto";
import {
  UpdateTalentRequestDto,
  UpdateTalentRequestStatusDto,
} from "./dto/update-talent-request.dto";

@Injectable()
export class TalentRequestsService {
  private readonly logger = new Logger(TalentRequestsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  /**
   * Calculates SLA metadata according to FR-REQ-01.
   * Standard 48h SLA deadline; alert stages: warn_24h (>=24h elapsed), warn_40h (>=40h elapsed), breached (past deadline).
   */
  computeSlaStatus(
    request: {
      createdAt: Date;
      qualifiedAt?: Date | null;
      slaDeadlineAt?: Date | null;
      firstShortlistAt?: Date | null;
      status: RequestStatus;
    },
    now: Date = new Date(),
  ): {
    slaDeadlineAt: Date | null;
    slaBreached: boolean;
    slaRemainingHours: number | null;
    slaWarningStage: "normal" | "warn_24h" | "warn_40h" | "breached";
  } {
    // If request has already met SLA or reached terminal state, compute based on fulfillment
    if (!request.slaDeadlineAt) {
      return {
        slaDeadlineAt: null,
        slaBreached: false,
        slaRemainingHours: null,
        slaWarningStage: "normal",
      };
    }

    const deadline = new Date(request.slaDeadlineAt);
    const startReference = request.qualifiedAt ?? request.createdAt;
    const diffMs = deadline.getTime() - now.getTime();
    const slaRemainingHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    const isBreached = now.getTime() > deadline.getTime() && !request.firstShortlistAt;

    let slaWarningStage: "normal" | "warn_24h" | "warn_40h" | "breached" = "normal";

    if (isBreached) {
      slaWarningStage = "breached";
    } else if (!request.firstShortlistAt) {
      const elapsedHours = (now.getTime() - new Date(startReference).getTime()) / (1000 * 60 * 60);
      if (elapsedHours >= 40) {
        slaWarningStage = "warn_40h";
      } else if (elapsedHours >= 24) {
        slaWarningStage = "warn_24h";
      }
    }

    return {
      slaDeadlineAt: deadline,
      slaBreached: isBreached,
      slaRemainingHours,
      slaWarningStage,
    };
  }

  /**
   * Helper to advance time by business hours, skipping weekends (Saturday & Sunday - FR-REQ-01).
   */
  private addBusinessHours(startDate: Date, hours: number): Date {
    const result = new Date(startDate);
    let remaining = hours;
    while (remaining > 0) {
      result.setTime(result.getTime() + 60 * 60 * 1000);
      const day = result.getUTCDay();
      // 0 is Sunday, 6 is Saturday
      if (day !== 0 && day !== 6) {
        remaining -= 1;
      }
    }
    return result;
  }

  /**
   * Helper to resolve SLA business hours from settings.
   */
  private async getSlaHours(): Promise<number> {
    try {
      const setting = await this.settingsService.getSettingByKey("sla.shortlist_business_hours");
      const val = Number(setting.value);
      return !isNaN(val) && val > 0 ? val : 48;
    } catch {
      return 48;
    }
  }

  /**
   * Create a talent request (by Admin/Sales or directly from Client Portal).
   */
  async createRequest(
    dto: CreateTalentRequestDto,
    currentUser: AuthenticatedUser,
  ): Promise<TalentRequestResponseDto> {
    // Scope check: Client users can only create requests for their own company
    let targetCompanyId = dto.companyId;
    if (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) {
      if (!currentUser.companyId) {
        throw new ForbiddenException("Client user is not associated with a company");
      }
      targetCompanyId = currentUser.companyId;
    }

    if (!targetCompanyId) {
      throw new BadRequestException("companyId is required to create a talent request");
    }

    // Verify company exists
    const company = await this.prisma.companies.findUnique({
      where: { id: targetCompanyId },
    });
    if (!company || company.deletedAt) {
      throw new NotFoundException(`Company ${targetCompanyId} not found`);
    }

    // Enforce FR-BILL-03: Unpaid invoice overdue by > 30 days blocks new talent requests
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const overdueInvoice = await this.prisma.invoices.findFirst({
      where: {
        companyId: targetCompanyId,
        status: { in: [InvoiceStatus.issued, InvoiceStatus.overdue, InvoiceStatus.partially_paid] },
        dueDate: { lt: thirtyDaysAgo },
      },
      select: { id: true, number: true },
    });
    if (overdueInvoice) {
      throw new UnprocessableEntityException({
        code: "FR-BILL-03",
        message: `Company has unpaid invoice ${overdueInvoice.number ?? overdueInvoice.id} overdue by more than 30 days. New talent requests are blocked (FR-BILL-03).`,
      });
    }

    // Calculate SLA deadline (FR-REQ-01: business hours excluding weekends)
    const slaHours = await this.getSlaHours();
    const now = new Date();
    const slaDeadlineAt = this.addBusinessHours(now, slaHours);

    // Calculate indicative pricing if not given
    let indicativePriceMin: Prisma.Decimal | null = null;
    let indicativePriceMax: Prisma.Decimal | null = null;
    if (dto.seniority) {
      try {
        const quote = await this.pricingService.calculatePricing({
          seniority: dto.seniority,
          isPartTime: dto.timeSharePct === 50,
          numTalents: dto.talentsCount,
        });
        indicativePriceMin = toDecimal(quote.netClientPrice);
        indicativePriceMax = indicativePriceMin.times(new Prisma.Decimal("1.25"));
      } catch {
        // Fallback silently if rate card missing
      }
    }

    const created = await this.prisma.withUserContext(currentUser, async (tx) => {
      const request = await tx.talentRequests.create({
        data: {
          companyId: targetCompanyId,
          requestedByContactId: dto.requestedByContactId,
          leadId: dto.leadId,
          sourceTalentId: dto.sourceTalentId,
          engagementModel: dto.engagementModel,
          categoryId: dto.categoryId,
          jobRoleId: dto.jobRoleId,
          roleTitle: dto.roleTitle,
          seniority: dto.seniority,
          talentsCount: dto.talentsCount,
          timezoneOverlapHours: dto.timezoneOverlapHours,
          startWindow: dto.startWindow,
          desiredStartDate: dto.desiredStartDate ? new Date(dto.desiredStartDate) : null,
          duration: dto.duration,
          timeSharePct: dto.timeSharePct,
          budgetMin: dto.budgetMin ? toDecimal(dto.budgetMin) : null,
          budgetMax: dto.budgetMax ? toDecimal(dto.budgetMax) : null,
          budgetCurrency: dto.budgetCurrency ?? company.currency ?? "EUR",
          indicativePriceMin,
          indicativePriceMax,
          description: dto.description,
          status: RequestStatus.open,
          recruiterId: dto.recruiterId,
          slaDeadlineAt,
          createdBy: currentUser.id,
        },
      });

      // Insert requested skills
      if (dto.skills && dto.skills.length > 0) {
        await tx.talentRequestSkills.createMany({
          data: dto.skills.map((s) => ({
            requestId: request.id,
            skillId: s.skillId,
            isRequired: s.isRequired ?? true,
            minLevel: s.minLevel,
          })),
        });
      }

      // Insert requested languages
      if (dto.languages && dto.languages.length > 0) {
        await tx.talentRequestLanguages.createMany({
          data: dto.languages.map((l) => ({
            requestId: request.id,
            languageCode: l.languageCode.toLowerCase(),
            minLevel: l.minLevel,
          })),
        });
      }

      return request;
    });

    return this.findById(created.id, currentUser);
  }

  /**
   * Find talent request by ID with relations and computed SLA status.
   */
  async findById(id: string, currentUser: AuthenticatedUser): Promise<TalentRequestResponseDto> {
    const request = await this.prisma.talentRequests.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException(`Talent request ${id} not found`);
    }

    // Client scope enforcement
    if (
      (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) &&
      request.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException("Access to this talent request is denied");
    }

    // Load relations
    const [company, recruiter, skills, languages, shortlistsCount] = await Promise.all([
      this.prisma.companies.findUnique({ where: { id: request.companyId }, select: { name: true } }),
      request.recruiterId
        ? this.prisma.users.findUnique({
            where: { id: request.recruiterId },
            select: { firstName: true, lastName: true },
          })
        : null,
      this.prisma.talentRequestSkills.findMany({
        where: { requestId: id },
      }),
      this.prisma.talentRequestLanguages.findMany({
        where: { requestId: id },
      }),
      this.prisma.shortlists.count({
        where: { requestId: id },
      }),
    ]);

    // Fetch skill names
    const skillIds = skills.map((s) => s.skillId);
    const taxonomySkills = skillIds.length > 0
      ? await this.prisma.skills.findMany({
          where: { id: { in: skillIds } },
          select: { id: true, name: true },
        })
      : [];
    const skillMap = new Map(taxonomySkills.map((s) => [s.id, s.name]));

    const sla = this.computeSlaStatus(request);

    return {
      id: request.id,
      companyId: request.companyId,
      companyName: company?.name,
      leadId: request.leadId,
      requestedByContactId: request.requestedByContactId,
      engagementModel: request.engagementModel,
      categoryId: request.categoryId,
      jobRoleId: request.jobRoleId,
      roleTitle: request.roleTitle,
      seniority: request.seniority,
      talentsCount: request.talentsCount,
      timezoneOverlapHours: request.timezoneOverlapHours,
      startWindow: request.startWindow,
      desiredStartDate: request.desiredStartDate ? request.desiredStartDate.toISOString().split("T")[0] : null,
      duration: request.duration,
      timeSharePct: request.timeSharePct,
      budgetMin: request.budgetMin ? request.budgetMin.toFixed(2) : null,
      budgetMax: request.budgetMax ? request.budgetMax.toFixed(2) : null,
      budgetCurrency: request.budgetCurrency,
      indicativePriceMin: request.indicativePriceMin ? request.indicativePriceMin.toFixed(2) : null,
      indicativePriceMax: request.indicativePriceMax ? request.indicativePriceMax.toFixed(2) : null,
      description: request.description,
      status: request.status,
      recruiterId: request.recruiterId,
      recruiterName: recruiter ? `${recruiter.firstName} ${recruiter.lastName}`.trim() : null,
      qualifiedAt: request.qualifiedAt ? request.qualifiedAt.toISOString() : null,
      slaDeadlineAt: sla.slaDeadlineAt ? sla.slaDeadlineAt.toISOString() : null,
      slaBreached: sla.slaBreached,
      slaRemainingHours: sla.slaRemainingHours,
      slaWarningStage: sla.slaWarningStage,
      firstShortlistAt: request.firstShortlistAt ? request.firstShortlistAt.toISOString() : null,
      closedAt: request.closedAt ? request.closedAt.toISOString() : null,
      lostReason: request.lostReason,
      cancelledReason: request.cancelledReason,
      skills: skills.map((s) => ({
        skillId: s.skillId,
        skillName: skillMap.get(s.skillId) || "Unknown Skill",
        isRequired: s.isRequired,
        minLevel: s.minLevel,
      })),
      languages: languages.map((l) => ({
        languageCode: l.languageCode,
        minLevel: l.minLevel,
      })),
      shortlistsCount,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
    };
  }

  /**
   * List talent requests with filters and pagination.
   */
  async findAll(query: QueryTalentRequestsDto, currentUser: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const skip = (page - 1) * pageSize;

    const where: Prisma.TalentRequestsWhereInput = {};

    // Scope check: Client users only see their company's requests
    if (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) {
      if (!currentUser.companyId) {
        throw new ForbiddenException("Client user has no associated company");
      }
      where.companyId = currentUser.companyId;
    } else if (query.companyId) {
      where.companyId = query.companyId;
    }

    if (query.status) {
      where.status = query.status;
    }
    if (query.recruiterId) {
      where.recruiterId = query.recruiterId;
    }
    if (query.engagementModel) {
      where.engagementModel = query.engagementModel;
    }
    if (query.seniority) {
      where.seniority = query.seniority;
    }

    if (query.search) {
      where.OR = [
        { roleTitle: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    const [total, requests] = await Promise.all([
      this.prisma.talentRequests.count({ where }),
      this.prisma.talentRequests.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const mapped = requests.map((req) => {
      const sla = this.computeSlaStatus(req);
      return {
        id: req.id,
        companyId: req.companyId,
        roleTitle: req.roleTitle,
        seniority: req.seniority,
        engagementModel: req.engagementModel,
        talentsCount: req.talentsCount,
        status: req.status,
        recruiterId: req.recruiterId,
        slaDeadlineAt: sla.slaDeadlineAt ? sla.slaDeadlineAt.toISOString() : null,
        slaBreached: sla.slaBreached,
        slaRemainingHours: sla.slaRemainingHours,
        slaWarningStage: sla.slaWarningStage,
        firstShortlistAt: req.firstShortlistAt ? req.firstShortlistAt.toISOString() : null,
        createdAt: req.createdAt.toISOString(),
      };
    });

    // Optional post-filter for slaBreached
    const finalData = query.slaBreached !== undefined
      ? mapped.filter((r) => r.slaBreached === query.slaBreached)
      : mapped;

    return {
      data: finalData,
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }

  /**
   * Update request details or status.
   */
  async updateRequest(
    id: string,
    dto: UpdateTalentRequestDto,
    currentUser: AuthenticatedUser,
  ): Promise<TalentRequestResponseDto> {
    const existing = await this.prisma.talentRequests.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Talent request ${id} not found`);
    }

    // Client scope enforcement
    if (
      (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) &&
      existing.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException("Access to update this request is denied");
    }

    // If changing status, route through updateStatus to enforce business rules
    if (dto.status && dto.status !== existing.status) {
      await this.updateStatus(
        id,
        {
          status: dto.status,
          lostReason: dto.lostReason,
          cancelledReason: dto.cancelledReason,
        },
        currentUser,
      );
    }

    await this.prisma.withUserContext(currentUser, async (tx) => {
      const data: Prisma.TalentRequestsUpdateInput = {};

      if (dto.roleTitle !== undefined) data.roleTitle = dto.roleTitle;
      if (dto.seniority !== undefined) data.seniority = dto.seniority;
      if (dto.talentsCount !== undefined) data.talentsCount = dto.talentsCount;
      if (dto.timezoneOverlapHours !== undefined) data.timezoneOverlapHours = dto.timezoneOverlapHours;
      if (dto.startWindow !== undefined) data.startWindow = dto.startWindow;
      if (dto.desiredStartDate !== undefined) {
        data.desiredStartDate = dto.desiredStartDate ? new Date(dto.desiredStartDate) : null;
      }
      if (dto.duration !== undefined) data.duration = dto.duration;
      if (dto.timeSharePct !== undefined) data.timeSharePct = dto.timeSharePct;
      if (dto.budgetMin !== undefined) data.budgetMin = dto.budgetMin ? toDecimal(dto.budgetMin) : null;
      if (dto.budgetMax !== undefined) data.budgetMax = dto.budgetMax ? toDecimal(dto.budgetMax) : null;
      if (dto.budgetCurrency !== undefined) data.budgetCurrency = dto.budgetCurrency;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.recruiterId !== undefined) data.recruiterId = dto.recruiterId;

      await tx.talentRequests.update({
        where: { id },
        data,
      });

      // Update skills if provided
      if (dto.skills !== undefined) {
        await tx.talentRequestSkills.deleteMany({ where: { requestId: id } });
        if (dto.skills.length > 0) {
          await tx.talentRequestSkills.createMany({
            data: dto.skills.map((s) => ({
              requestId: id,
              skillId: s.skillId,
              isRequired: s.isRequired ?? true,
              minLevel: s.minLevel,
            })),
          });
        }
      }

      // Update languages if provided
      if (dto.languages !== undefined) {
        await tx.talentRequestLanguages.deleteMany({ where: { requestId: id } });
        if (dto.languages.length > 0) {
          await tx.talentRequestLanguages.createMany({
            data: dto.languages.map((l) => ({
              requestId: id,
              languageCode: l.languageCode.toLowerCase(),
              minLevel: l.minLevel,
            })),
          });
        }
      }
    });

    return this.findById(id, currentUser);
  }

  /**
   * Update request status with business rules enforcement (FR-REQ-01, FR-REQ-02).
   */
  async updateStatus(
    id: string,
    dto: UpdateTalentRequestStatusDto,
    currentUser: AuthenticatedUser,
  ): Promise<TalentRequestResponseDto> {
    const existing = await this.prisma.talentRequests.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Talent request ${id} not found`);
    }

    // Client scope enforcement
    if (
      (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) &&
      existing.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException("Access to update this request is denied");
    }

    // FR-REQ-02: A lost request requires a lost reason
    if (dto.status === RequestStatus.lost && !dto.lostReason) {
      throw new UnprocessableEntityException({
        code: "FR-REQ-02",
        message: "A lost request requires a lost reason.",
      });
    }

    const now = new Date();
    const updateData: Prisma.TalentRequestsUpdateInput = {
      status: dto.status,
      lostReason: dto.status === RequestStatus.lost ? dto.lostReason : null,
      cancelledReason: dto.status === RequestStatus.cancelled ? dto.cancelledReason : null,
    };

    // If moving to sourcing/qualified, ensure qualifiedAt & SLA countdown are initialized
    if (dto.status === RequestStatus.sourcing && !existing.qualifiedAt) {
      updateData.qualifiedAt = now;
      if (!existing.slaDeadlineAt) {
        const slaHours = await this.getSlaHours();
        updateData.slaDeadlineAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
      }
    }

    // Terminal statuses set closedAt
    if (
      dto.status === RequestStatus.won ||
      dto.status === RequestStatus.lost ||
      dto.status === RequestStatus.cancelled
    ) {
      updateData.closedAt = now;
    }

    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.talentRequests.update({
        where: { id },
        data: updateData,
      });
    });

    return this.findById(id, currentUser);
  }
}

