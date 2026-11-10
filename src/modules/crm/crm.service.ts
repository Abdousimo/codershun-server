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
  CompanyStatus,
  InvoiceStatus,
  LeadStage,
  PlacementStatus,
  Prisma,
  RequestStatus,
  TaskStatus,
  TimesheetStatus,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { toDecimal } from "../../common/utils/money";
import { QueryCompaniesDto, QueryLeadsDto } from "./dto/query-crm.dto";
import { CreateCompanyDto, UpdateCompanyDto } from "./dto/company.dto";
import { CreateContactDto, UpdateContactDto } from "./dto/contact.dto";
import {
  ChangeLeadStageDto,
  CreateLeadDto,
  UpdateLeadDto,
} from "./dto/lead.dto";
import {
  CreateNoteDto,
  CreateTaskDto,
  UpdateTaskDto,
} from "./dto/timeline.dto";

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==========================================
  // COMPANIES
  // ==========================================

  async getCompanies(query: QueryCompaniesDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.CompaniesWhereInput = {
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.countryCode && { countryCode: query.countryCode.toUpperCase() }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { website: { contains: query.search, mode: "insensitive" } },
          { billingEmail: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.companies.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.companies.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getCompanyById(id: string) {
    const company = await this.prisma.companies.findFirst({
      where: { id, deletedAt: null },
    });

    if (!company) {
      throw new NotFoundException(`Company ${id} not found`);
    }

    const [contacts, leads, companyTags] = await Promise.all([
      this.prisma.contacts.findMany({ where: { companyId: id }, orderBy: { createdAt: "asc" } }),
      this.prisma.leads.findMany({ where: { companyId: id }, orderBy: { createdAt: "desc" } }),
      this.prisma.companyTags.findMany({ where: { companyId: id } }),
    ]);

    return {
      ...company,
      contacts,
      leads,
      tagIds: companyTags.map((ct) => ct.tagId),
    };
  }

  async createCompany(dto: CreateCompanyDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      const company = await tx.companies.create({
        data: {
          name: dto.name,
          legalName: dto.legalName,
          countryCode: dto.countryCode?.toUpperCase(),
          industry: dto.industry,
          sizeRange: dto.sizeRange,
          website: dto.website,
          vatNumber: dto.vatNumber,
          billingAddress: dto.billingAddress,
          billingCity: dto.billingCity,
          billingPostalCode: dto.billingPostalCode,
          billingCountryCode: dto.billingCountryCode?.toUpperCase(),
          billingEmail: dto.billingEmail,
          currency: dto.currency ?? "EUR",
          status: dto.status ?? CompanyStatus.lead,
          source: dto.source,
          accountManagerId: dto.accountManagerId,
          workCalendarId: dto.workCalendarId,
          paymentTermsDays: dto.paymentTermsDays ?? 7,
          notes: dto.notes,
          createdBy: currentUser.id,
        },
      });

      if (dto.tagIds && dto.tagIds.length > 0) {
        await tx.companyTags.createMany({
          data: dto.tagIds.map((tagId) => ({
            companyId: company.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      return company;
    });
  }

  async updateCompany(id: string, dto: UpdateCompanyDto, currentUser: AuthenticatedUser) {
    await this.getCompanyById(id);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.companies.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.legalName !== undefined && { legalName: dto.legalName }),
          ...(dto.countryCode !== undefined && { countryCode: dto.countryCode.toUpperCase() }),
          ...(dto.industry !== undefined && { industry: dto.industry }),
          ...(dto.sizeRange !== undefined && { sizeRange: dto.sizeRange }),
          ...(dto.website !== undefined && { website: dto.website }),
          ...(dto.vatNumber !== undefined && { vatNumber: dto.vatNumber }),
          ...(dto.billingAddress !== undefined && { billingAddress: dto.billingAddress }),
          ...(dto.billingCity !== undefined && { billingCity: dto.billingCity }),
          ...(dto.billingPostalCode !== undefined && { billingPostalCode: dto.billingPostalCode }),
          ...(dto.billingCountryCode !== undefined && { billingCountryCode: dto.billingCountryCode.toUpperCase() }),
          ...(dto.billingEmail !== undefined && { billingEmail: dto.billingEmail }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.accountManagerId !== undefined && { accountManagerId: dto.accountManagerId }),
          ...(dto.workCalendarId !== undefined && { workCalendarId: dto.workCalendarId }),
          ...(dto.paymentTermsDays !== undefined && { paymentTermsDays: dto.paymentTermsDays }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          updatedAt: new Date(),
        },
      });

      if (dto.tagIds !== undefined) {
        await tx.companyTags.deleteMany({ where: { companyId: id } });
        if (dto.tagIds.length > 0) {
          await tx.companyTags.createMany({
            data: dto.tagIds.map((tagId) => ({ companyId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      return updated;
    });
  }

  async softDeleteCompany(id: string, currentUser: AuthenticatedUser) {
    await this.getCompanyById(id);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.companies.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  // ==========================================
  // CONTACTS
  // ==========================================

  async getCompanyContacts(companyId: string) {
    return this.prisma.contacts.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createContact(companyId: string, dto: CreateContactDto, currentUser: AuthenticatedUser) {
    await this.getCompanyById(companyId);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.contacts.create({
        data: {
          companyId,
          userId: dto.userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          jobTitle: dto.jobTitle,
          isDecisionMaker: dto.isDecisionMaker ?? false,
          isBillingContact: dto.isBillingContact ?? false,
          linkedinUrl: dto.linkedinUrl,
          createdBy: currentUser.id,
        },
      });
    });
  }

  async updateContact(id: string, dto: UpdateContactDto, currentUser: AuthenticatedUser) {
    const contact = await this.prisma.contacts.findUnique({ where: { id } });
    if (!contact) {
      throw new NotFoundException(`Contact ${id} not found`);
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.contacts.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.email !== undefined && { email: dto.email }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
          ...(dto.isDecisionMaker !== undefined && { isDecisionMaker: dto.isDecisionMaker }),
          ...(dto.isBillingContact !== undefined && { isBillingContact: dto.isBillingContact }),
          ...(dto.linkedinUrl !== undefined && { linkedinUrl: dto.linkedinUrl }),
          updatedAt: new Date(),
        },
      });
    });
  }

  // ==========================================
  // LEADS & SALES PIPELINE (CDC 6.2, FR-REQ-02)
  // ==========================================

  async getLeads(query: QueryLeadsDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.LeadsWhereInput = {
      ...(query.stage && { stage: query.stage }),
      ...(query.source && { source: query.source }),
      ...(query.ownerId && { ownerId: query.ownerId }),
      ...(query.companyId && { companyId: query.companyId }),
      ...(query.search && {
        OR: [
          { notes: { contains: query.search, mode: "insensitive" } },
          { referralCode: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.leads.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.leads.count({ where }),
    ]);

    // Fetch related company names
    const companyIds = [...new Set(data.map((l) => l.companyId))];
    const companies = await this.prisma.companies.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true, countryCode: true },
    });
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    const enriched = data.map((l) => ({
      ...l,
      company: companyMap.get(l.companyId) ?? null,
    }));

    return {
      data: enriched,
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getLeadsKanban() {
    const stages = Object.values(LeadStage);
    const leads = await this.prisma.leads.findMany({
      orderBy: { createdAt: "desc" },
    });

    const companyIds = [...new Set(leads.map((l) => l.companyId))];
    const companies = await this.prisma.companies.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true, countryCode: true },
    });
    const companyMap = new Map(companies.map((c) => [c.id, c]));

    const kanban: Record<LeadStage, any[]> = {} as any;
    for (const stage of stages) {
      kanban[stage] = [];
    }

    for (const lead of leads) {
      kanban[lead.stage].push({
        ...lead,
        company: companyMap.get(lead.companyId) ?? null,
      });
    }

    return kanban;
  }

  async getLeadById(id: string) {
    const lead = await this.prisma.leads.findUnique({
      where: { id },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} not found`);
    }

    const [company, contact, notes, tasks] = await Promise.all([
      this.prisma.companies.findUnique({ where: { id: lead.companyId } }),
      lead.contactId ? this.prisma.contacts.findUnique({ where: { id: lead.contactId } }) : null,
      this.prisma.notes.findMany({
        where: { entityType: "lead", entityId: id },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.tasks.findMany({
        where: { entityType: "lead", entityId: id },
        orderBy: { dueAt: "asc" },
      }),
    ]);

    return {
      ...lead,
      company,
      contact,
      notes,
      tasks,
    };
  }

  async createLead(dto: CreateLeadDto, currentUser: AuthenticatedUser) {
    await this.getCompanyById(dto.companyId);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.leads.create({
        data: {
          companyId: dto.companyId,
          contactId: dto.contactId,
          stage: dto.stage ?? LeadStage.new_lead,
          source: dto.source,
          heardAboutUs: dto.heardAboutUs,
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          utmTerm: dto.utmTerm,
          utmContent: dto.utmContent,
          landingPage: dto.landingPage,
          referrerUrl: dto.referrerUrl,
          referralCode: dto.referralCode,
          referrerId: dto.referrerId,
          ownerId: dto.ownerId ?? currentUser.id,
          estimatedMonthlyValue: dto.estimatedMonthlyValue ? toDecimal(dto.estimatedMonthlyValue) : null,
          discoveryCallAt: dto.discoveryCallAt ? new Date(dto.discoveryCallAt) : null,
          discoveryCallUrl: dto.discoveryCallUrl,
          notes: dto.notes,
          createdBy: currentUser.id,
        },
      });
    });
  }

  async updateLead(id: string, dto: UpdateLeadDto, currentUser: AuthenticatedUser) {
    await this.getLeadById(id);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.leads.update({
        where: { id },
        data: {
          ...(dto.contactId !== undefined && { contactId: dto.contactId }),
          ...(dto.ownerId !== undefined && { ownerId: dto.ownerId }),
          ...(dto.estimatedMonthlyValue !== undefined && {
            estimatedMonthlyValue: dto.estimatedMonthlyValue ? toDecimal(dto.estimatedMonthlyValue) : null,
          }),
          ...(dto.discoveryCallAt !== undefined && {
            discoveryCallAt: dto.discoveryCallAt ? new Date(dto.discoveryCallAt) : null,
          }),
          ...(dto.discoveryCallUrl !== undefined && { discoveryCallUrl: dto.discoveryCallUrl }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          updatedAt: new Date(),
        },
      });
    });
  }

  /**
   * Updates lead pipeline stage.
   * Enforces Rule FR-REQ-02: A lost lead requires a lost reason.
   */
  async changeLeadStage(id: string, dto: ChangeLeadStageDto, currentUser: AuthenticatedUser) {
    const lead = await this.getLeadById(id);

    // Rule FR-REQ-02 enforcement
    if (dto.stage === LeadStage.lost && !dto.lostReason) {
      throw new UnprocessableEntityException({
        code: "FR-REQ-02",
        message: "A lost reason is required when marking a lead as lost",
      });
    }

    const now = new Date();

    return this.prisma.withUserContext(currentUser, async (tx) => {
      // Stage transition timestamps
      const updateData: Prisma.LeadsUpdateInput = {
        stage: dto.stage,
        updatedAt: now,
      };

      if (dto.stage === LeadStage.contacted && !lead.firstContactedAt) {
        updateData.firstContactedAt = now;
      } else if (dto.stage === LeadStage.qualified && !lead.qualifiedAt) {
        updateData.qualifiedAt = now;
      } else if (dto.stage === LeadStage.won) {
        if (!lead.wonAt) {
          updateData.wonAt = now;
        }
        // When won, company moves to client status
        await tx.companies.update({
          where: { id: lead.companyId },
          data: { status: CompanyStatus.client, updatedAt: now },
        });
      } else if (dto.stage === LeadStage.lost) {
        updateData.lostAt = now;
        updateData.lostReason = dto.lostReason;
        updateData.lostReasonDetail = dto.lostReasonDetail;
      }

      return tx.leads.update({
        where: { id },
        data: updateData,
      });
    });
  }

  // ==========================================
  // NOTES & TASKS
  // ==========================================

  async getNotes(entityType: string, entityId: string) {
    return this.prisma.notes.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createNote(dto: CreateNoteDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.notes.create({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          body: dto.body,
          isInternal: dto.isInternal ?? true,
          authorId: currentUser.id,
        },
      });
    });
  }

  async getTasks(entityType?: string, entityId?: string, assigneeId?: string) {
    return this.prisma.tasks.findMany({
      where: {
        ...(entityType && { entityType }),
        ...(entityId && { entityId }),
        ...(assigneeId && { assigneeId }),
      },
      orderBy: { dueAt: "asc" },
    });
  }

  async createTask(dto: CreateTaskDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.tasks.create({
        data: {
          entityType: dto.entityType,
          entityId: dto.entityId,
          title: dto.title,
          description: dto.description,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          status: TaskStatus.open,
          assigneeId: dto.assigneeId ?? currentUser.id,
          createdBy: currentUser.id,
        },
      });
    });
  }

  async updateTask(id: string, dto: UpdateTaskDto, currentUser: AuthenticatedUser) {
    const task = await this.prisma.tasks.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const isCompleting = dto.status === TaskStatus.done && task.status !== TaskStatus.done;
      return tx.tasks.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.dueAt !== undefined && { dueAt: dto.dueAt ? new Date(dto.dueAt) : null }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
          ...(isCompleting && { completedAt: new Date() }),
        },
      });
    });
  }

  // ==========================================
  // CLIENT PORTAL DASHBOARD
  // ==========================================

  async getClientDashboard(currentUser: AuthenticatedUser) {
    let companyId = currentUser.companyId;
    if (!companyId && currentUser.id) {
      const cu = await this.prisma.companyUsers.findFirst({
        where: { userId: currentUser.id },
        select: { companyId: true },
      });
      companyId = cu?.companyId;
    }
    if (!companyId && currentUser.role === UserRole.super_admin) {
      const firstComp = await this.prisma.companies.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      companyId = firstComp?.id;
    }

    if (!companyId) {
      throw new ForbiddenException("No client company profile associated with this account");
    }

    const company = await this.prisma.companies.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        industry: true,
        currency: true,
        isOverdueFlagged: true,
        accountManagerId: true,
        paymentTermsDays: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    let accountManager = null;
    if (company.accountManagerId) {
      const am = await this.prisma.users.findUnique({
        where: { id: company.accountManagerId },
        select: { firstName: true, lastName: true, email: true },
      });
      if (am) {
        accountManager = {
          name: `${am.firstName || ""} ${am.lastName || ""}`.trim() || am.email,
          email: am.email,
        };
      }
    }

    // Active Placements (strictly hiding internal margins & talentPay per FR-SEC-02)
    const activePlacements = await this.prisma.placements.findMany({
      where: {
        companyId,
        status: { in: [PlacementStatus.in_trial, PlacementStatus.active, PlacementStatus.notice] },
      },
      select: {
        id: true,
        reference: true,
        status: true,
        seniority: true,
        engagementModel: true,
        startDate: true,
        trialEndDate: true,
        clientPriceNet: true,
        clientPrice: true,
        currency: true,
        talentId: true,
        jobRoleId: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const activeCount = activePlacements.length;
    const trialCount = activePlacements.filter((p) => p.status === PlacementStatus.in_trial).length;

    // Open Talent Requests
    const openRequestStatuses = [
      RequestStatus.open,
      RequestStatus.sourcing,
      RequestStatus.shortlist_sent,
      RequestStatus.interviewing,
      RequestStatus.proposal_sent,
    ];

    const openRequests = await this.prisma.talentRequests.findMany({
      where: {
        companyId,
        status: { in: openRequestStatuses },
      },
      select: {
        id: true,
        roleTitle: true,
        seniority: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const openRequestsCount = await this.prisma.talentRequests.count({
      where: {
        companyId,
        status: { in: openRequestStatuses },
      },
    });

    // Pending Timesheets for this company's placements
    const placementIds = activePlacements.map((p) => p.id);
    const pendingTimesheets = placementIds.length > 0
      ? await this.prisma.timesheets.findMany({
          where: {
            placementId: { in: placementIds },
            status: TimesheetStatus.submitted,
          },
          select: {
            id: true,
            periodMonth: true,
            totalDays: true,
            totalHours: true,
            submittedAt: true,
            placementId: true,
          },
          orderBy: { submittedAt: "desc" },
          take: 5,
        })
      : [];

    const pendingTimesheetsCount = placementIds.length > 0
      ? await this.prisma.timesheets.count({
          where: {
            placementId: { in: placementIds },
            status: TimesheetStatus.submitted,
          },
        })
      : 0;

    // Outstanding Invoices
    const outstandingInvoices = await this.prisma.invoices.findMany({
      where: {
        companyId,
        status: { in: [InvoiceStatus.issued, InvoiceStatus.overdue, InvoiceStatus.partially_paid] },
      },
      select: {
        id: true,
        number: true,
        total: true,
        currency: true,
        dueDate: true,
        status: true,
      },
      orderBy: { dueDate: "asc" },
    });

    const outstandingTotal = outstandingInvoices.reduce(
      (sum, inv) => sum.plus(inv.total),
      new Prisma.Decimal(0),
    );

    // Active Team Preview (clean anonymization & price only)
    const activeTeamPreview = await Promise.all(
      activePlacements.slice(0, 5).map(async (p) => {
        let roleName = "Software Engineer";
        if (p.jobRoleId) {
          const jr = await this.prisma.jobRoles.findUnique({
            where: { id: p.jobRoleId },
            select: { nameEn: true },
          });
          if (jr?.nameEn) roleName = jr.nameEn;
        }

        let talentDisplayName = `Engineer ${p.reference}`;
        if (p.talentId) {
          const tal = await this.prisma.talents.findUnique({
            where: { id: p.talentId },
            select: { firstName: true },
          });
          if (tal?.firstName) talentDisplayName = tal.firstName;
        }

        let trialDay: number | null = null;
        if (p.status === PlacementStatus.in_trial && p.startDate) {
          const elapsed = Math.ceil(
            (Date.now() - new Date(p.startDate).getTime()) / (1000 * 60 * 60 * 24),
          );
          trialDay = Math.min(10, Math.max(1, elapsed));
        }

        return {
          id: p.id,
          reference: p.reference,
          talentName: talentDisplayName,
          roleName,
          seniority: p.seniority,
          status: p.status,
          trialDay,
          startDate: p.startDate ? p.startDate.toISOString().split("T")[0] : null,
          trialEndDate: p.trialEndDate ? p.trialEndDate.toISOString().split("T")[0] : null,
          monthlyPrice: p.clientPriceNet
            ? new Prisma.Decimal(p.clientPriceNet).toFixed(2)
            : p.clientPrice
            ? new Prisma.Decimal(p.clientPrice).toFixed(2)
            : "0.00",
          currency: p.currency,
        };
      }),
    );

    return {
      company: {
        id: company.id,
        name: company.name,
        legalName: company.legalName,
        industry: company.industry,
        currency: company.currency,
        isOverdueFlagged: company.isOverdueFlagged,
        accountManager,
      },
      kpis: {
        activeDevelopersCount: activeCount,
        trialDevelopersCount: trialCount,
        openTalentRequestsCount: openRequestsCount,
        pendingTimesheetsCount,
        outstandingInvoicesAmount: outstandingTotal.toFixed(2),
        outstandingInvoicesCount: outstandingInvoices.length,
      },
      activeTeamPreview,
      pendingTimesheets: pendingTimesheets.map((ts) => ({
        id: ts.id,
        periodMonth: ts.periodMonth,
        totalDays: ts.totalDays ? new Prisma.Decimal(ts.totalDays).toFixed(1) : "0.0",
        totalHours: ts.totalHours ? new Prisma.Decimal(ts.totalHours).toFixed(1) : "0.0",
        submittedAt: ts.submittedAt ? ts.submittedAt.toISOString() : null,
      })),
      activeRequests: openRequests.map((req) => ({
        id: req.id,
        roleTitle: req.roleTitle,
        seniority: req.seniority,
        status: req.status,
        createdAt: req.createdAt.toISOString(),
      })),
      recentInvoices: outstandingInvoices.slice(0, 3).map((inv) => ({
        id: inv.id,
        number: inv.number,
        total: new Prisma.Decimal(inv.total).toFixed(2),
        currency: inv.currency,
        status: inv.status,
        dueDate: inv.dueDate ? inv.dueDate.toISOString().split("T")[0] : null,
      })),
    };
  }

  // ==========================================
  // CLIENT PORTAL WORKSPACE & MEMBERS
  // ==========================================

  async getClientWorkspace(currentUser: AuthenticatedUser) {
    let companyId = currentUser.companyId;
    if (!companyId && currentUser.id) {
      const cu = await this.prisma.companyUsers.findFirst({
        where: { userId: currentUser.id },
        select: { companyId: true },
      });
      companyId = cu?.companyId;
    }
    if (!companyId && currentUser.role === UserRole.super_admin) {
      const firstComp = await this.prisma.companies.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      companyId = firstComp?.id;
    }

    if (!companyId) {
      throw new ForbiddenException("No client company profile associated with this account");
    }

    const company = await this.prisma.companies.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return {
      id: company.id,
      name: company.name,
      legalName: company.legalName,
      industry: company.industry,
      website: company.website,
      vatNumber: company.vatNumber,
      billingAddress: company.billingAddress,
      billingCity: company.billingCity,
      billingPostalCode: company.billingPostalCode,
      billingCountryCode: company.billingCountryCode,
      billingEmail: company.billingEmail,
      currency: company.currency,
      paymentTermsDays: company.paymentTermsDays,
    };
  }

  async updateClientWorkspace(
    dto: {
      legalName?: string;
      website?: string;
      vatNumber?: string;
      billingAddress?: string;
      billingCity?: string;
      billingPostalCode?: string;
      billingCountryCode?: string;
      billingEmail?: string;
    },
    currentUser: AuthenticatedUser,
  ) {
    let companyId = currentUser.companyId;
    if (!companyId && currentUser.id) {
      const cu = await this.prisma.companyUsers.findFirst({
        where: { userId: currentUser.id },
        select: { companyId: true, isAdmin: true },
      });
      if (cu && !cu.isAdmin && currentUser.role !== UserRole.client_admin && currentUser.role !== UserRole.super_admin) {
        throw new ForbiddenException("Only company admins can update workspace settings");
      }
      companyId = cu?.companyId;
    }
    if (!companyId && currentUser.role === UserRole.super_admin) {
      const firstComp = await this.prisma.companies.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      companyId = firstComp?.id;
    }

    if (!companyId) {
      throw new ForbiddenException("No client company profile associated with this account");
    }

    const updated = await this.prisma.companies.update({
      where: { id: companyId },
      data: {
        ...(dto.legalName !== undefined && { legalName: dto.legalName }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.vatNumber !== undefined && { vatNumber: dto.vatNumber }),
        ...(dto.billingAddress !== undefined && { billingAddress: dto.billingAddress }),
        ...(dto.billingCity !== undefined && { billingCity: dto.billingCity }),
        ...(dto.billingPostalCode !== undefined && { billingPostalCode: dto.billingPostalCode }),
        ...(dto.billingCountryCode !== undefined && { billingCountryCode: dto.billingCountryCode }),
        ...(dto.billingEmail !== undefined && { billingEmail: dto.billingEmail }),
      },
    });

    return {
      message: "Company profile updated successfully",
      company: updated,
    };
  }

  async getClientWorkspaceMembers(currentUser: AuthenticatedUser) {
    let companyId = currentUser.companyId;
    if (!companyId && currentUser.id) {
      const cu = await this.prisma.companyUsers.findFirst({
        where: { userId: currentUser.id },
        select: { companyId: true },
      });
      companyId = cu?.companyId;
    }
    if (!companyId && currentUser.role === UserRole.super_admin) {
      const firstComp = await this.prisma.companies.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      companyId = firstComp?.id;
    }

    if (!companyId) {
      throw new ForbiddenException("No client company profile associated with this account");
    }

    const members = await this.prisma.companyUsers.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });

    const userIds = members.map((m) => m.userId);
    const users = await this.prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return members.map((m) => {
      const u = userMap.get(m.userId);
      return {
        id: m.id,
        userId: m.userId,
        name: u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "Colleague",
        email: u?.email || "",
        role: u?.role || "client_user",
        isAdmin: m.isAdmin,
        canViewInvoices: m.canViewInvoices,
        createdAt: m.createdAt.toISOString(),
      };
    });
  }

  async inviteClientWorkspaceMember(
    dto: {
      email: string;
      firstName?: string;
      lastName?: string;
      isAdmin?: boolean;
      canViewInvoices?: boolean;
    },
    currentUser: AuthenticatedUser,
  ) {
    let companyId = currentUser.companyId;
    if (!companyId && currentUser.id) {
      const cu = await this.prisma.companyUsers.findFirst({
        where: { userId: currentUser.id },
        select: { companyId: true, isAdmin: true },
      });
      if (cu && !cu.isAdmin && currentUser.role !== UserRole.client_admin && currentUser.role !== UserRole.super_admin) {
        throw new ForbiddenException("Only company admins can invite team members");
      }
      companyId = cu?.companyId;
    }
    if (!companyId && currentUser.role === UserRole.super_admin) {
      const firstComp = await this.prisma.companies.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      companyId = firstComp?.id;
    }

    if (!companyId) {
      throw new ForbiddenException("No client company profile associated with this account");
    }

    const email = dto.email.trim().toLowerCase();

    // Check if user already exists
    let user = await this.prisma.users.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.users.create({
        data: {
          email,
          firstName: dto.firstName || "Colleague",
          lastName: dto.lastName || "",
          role: dto.isAdmin ? UserRole.client_admin : UserRole.client_user,
          passwordHash: "INVITED_PENDING_ACTIVATION",
        },
      });
    }

    const cu = await this.prisma.companyUsers.upsert({
      where: { companyId_userId: { companyId, userId: user.id } },
      update: {
        isAdmin: !!dto.isAdmin,
        canViewInvoices: !!dto.canViewInvoices,
      },
      create: {
        companyId,
        userId: user.id,
        isAdmin: !!dto.isAdmin,
        canViewInvoices: !!dto.canViewInvoices,
        invitedBy: currentUser.id,
        invitedAt: new Date(),
      },
    });

    return {
      message: "Colleague successfully added to company workspace",
      memberId: cu.id,
      email: user.email,
    };
  }
}

