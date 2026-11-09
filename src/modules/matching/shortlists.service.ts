import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import * as crypto from "node:crypto";
import {
  ClientDecision,
  Prisma,
  RequestStatus,
  SeniorityLevel,
  ShortlistStatus,
  TalentResponse,
  TalentStatus,
  UserRole,
  VettingStage,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PricingService } from "../settings/pricing.service";
import { toDecimal } from "../../common/utils/money";
import { CreateShortlistDto } from "./dto/create-shortlist.dto";
import { AddShortlistItemDto, UpdateShortlistItemDto } from "./dto/shortlist-item.dto";
import { ShortlistClientDecisionDto } from "./dto/client-decision.dto";
import {
  AdminShortlistResponseDto,
  AnonymisedShortlistItemDto,
  ClientShortlistResponseDto,
} from "./dto/shortlist-response.dto";
import { MatchingService } from "./matching.service";

@Injectable()
export class ShortlistsService {
  private readonly logger = new Logger(ShortlistsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly matchingService: MatchingService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Create a new draft shortlist version for a talent request.
   */
  async createShortlist(
    requestId: string,
    dto: CreateShortlistDto,
    currentUser: AuthenticatedUser,
  ): Promise<AdminShortlistResponseDto> {
    const request = await this.prisma.talentRequests.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundException(`Talent request ${requestId} not found`);
    }

    // Determine next version number
    const latest = await this.prisma.shortlists.findFirst({
      where: { requestId },
      orderBy: { version: "desc" },
    });
    const nextVersion = latest ? latest.version + 1 : 1;

    const shortlist = await this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.shortlists.create({
        data: {
          requestId,
          version: nextVersion,
          status: ShortlistStatus.draft,
          createdBy: currentUser.id,
        },
      });
    });

    return this.findAdminShortlistById(shortlist.id, currentUser);
  }

  /**
   * Add a talent to a shortlist item (FR-TAL-01).
   * Only talents in vettingStage 'vetted', status IN ('available','proposed'), and not blacklisted can be added.
   */
  async addItem(
    shortlistId: string,
    dto: AddShortlistItemDto,
    currentUser: AuthenticatedUser,
  ): Promise<AdminShortlistResponseDto> {
    const shortlist = await this.prisma.shortlists.findUnique({
      where: { id: shortlistId },
    });

    if (!shortlist) {
      throw new NotFoundException(`Shortlist ${shortlistId} not found`);
    }

    if (shortlist.status === ShortlistStatus.closed) {
      throw new BadRequestException("Cannot modify a closed shortlist");
    }

    const request = await this.prisma.talentRequests.findUnique({
      where: { id: shortlist.requestId },
    });
    if (!request) {
      throw new NotFoundException(`Talent request ${shortlist.requestId} not found`);
    }

    const [reqSkills, reqLanguages] = await Promise.all([
      this.prisma.talentRequestSkills.findMany({ where: { requestId: request.id } }),
      this.prisma.talentRequestLanguages.findMany({ where: { requestId: request.id } }),
    ]);

    // Check talent eligibility (FR-TAL-01)
    const talent = await this.prisma.talents.findUnique({
      where: { id: dto.talentId },
    });

    if (!talent || talent.deletedAt) {
      throw new NotFoundException(`Talent ${dto.talentId} not found`);
    }

    // Strict FR-TAL-01 enforcement
    const isVetted = talent.vettingStage === VettingStage.vetted;
    const isAvailableOrProposed =
      talent.status === TalentStatus.available || talent.status === TalentStatus.proposed;
    const isNotBlacklisted = !talent.isBlacklisted;

    if (!isVetted || !isAvailableOrProposed || !isNotBlacklisted) {
      throw new UnprocessableEntityException({
        code: "FR-TAL-01",
        message: "Only talents in status Vetted/Available can be added to a shortlist.",
      });
    }

    const [talentSkills, talentLanguages] = await Promise.all([
      this.prisma.talentSkills.findMany({ where: { talentId: talent.id } }),
      this.prisma.talentLanguages.findMany({ where: { talentId: talent.id } }),
    ]);

    // Calculate proposed client price if not supplied
    let proposedClientPrice: Prisma.Decimal | null = dto.proposedClientPrice
      ? toDecimal(dto.proposedClientPrice)
      : null;

    if (!proposedClientPrice) {
      try {
        const quote = await this.pricingService.calculatePricing({
          seniority: talent.seniority ?? request.seniority ?? SeniorityLevel.mid,
          talentNetPay: talent.agreedPay ? talent.agreedPay.toString() : undefined,
          isPartTime: request.timeSharePct === 50,
        });
        proposedClientPrice = toDecimal(quote.netClientPrice);
      } catch {
        // Leave null if pricing calculation fails
      }
    }

    // Calculate match score & breakdown
    const weights = await this.matchingService.getWeights();
    const breakdown = this.matchingService.calculateMatchBreakdown(
      {
        seniority: request.seniority,
        desiredStartDate: request.desiredStartDate,
        timeSharePct: request.timeSharePct,
        skills: reqSkills,
        languages: reqLanguages,
      },
      {
        seniority: talent.seniority,
        status: talent.status,
        availabilityDate: talent.availabilityDate,
        timeSharePct: talent.timeSharePct,
        vettingScore: talent.vettingScore,
        skills: talentSkills,
        languages: talentLanguages,
      },
      weights,
    );
    const totalMatchScore = Math.min(
      100,
      Math.round(
        (breakdown.skills +
          breakdown.seniority +
          breakdown.availability +
          breakdown.language +
          breakdown.vetting) *
          10,
      ) / 10,
    );

    // Get current item count for sortOrder
    const count = await this.prisma.shortlistItems.count({
      where: { shortlistId },
    });

    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.shortlistItems.upsert({
        where: {
          shortlistId_talentId: {
            shortlistId,
            talentId: dto.talentId,
          },
        },
        create: {
          shortlistId,
          talentId: dto.talentId,
          matchScore: toDecimal(totalMatchScore),
          matchBreakdown: breakdown as unknown as Prisma.InputJsonValue,
          recruiterNote: dto.recruiterNote,
          proposedClientPrice,
          proposedCurrency: dto.proposedCurrency ?? request.budgetCurrency ?? "EUR",
          sortOrder: count,
        },
        update: {
          recruiterNote: dto.recruiterNote,
          proposedClientPrice,
          proposedCurrency: dto.proposedCurrency ?? request.budgetCurrency ?? "EUR",
          matchScore: toDecimal(totalMatchScore),
          matchBreakdown: breakdown as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return this.findAdminShortlistById(shortlistId, currentUser);
  }

  /**
   * Update shortlist item (recruiter note, proposed price, sort order).
   */
  async updateItem(
    shortlistId: string,
    talentId: string,
    dto: UpdateShortlistItemDto,
    currentUser: AuthenticatedUser,
  ): Promise<AdminShortlistResponseDto> {
    const item = await this.prisma.shortlistItems.findUnique({
      where: { shortlistId_talentId: { shortlistId, talentId } },
    });
    if (!item) {
      throw new NotFoundException(`Shortlist item not found`);
    }

    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.shortlistItems.update({
        where: { shortlistId_talentId: { shortlistId, talentId } },
        data: {
          recruiterNote: dto.recruiterNote !== undefined ? dto.recruiterNote : item.recruiterNote,
          proposedClientPrice: dto.proposedClientPrice !== undefined ? toDecimal(dto.proposedClientPrice) : item.proposedClientPrice,
          proposedCurrency: dto.proposedCurrency !== undefined ? dto.proposedCurrency : item.proposedCurrency,
          sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : item.sortOrder,
        },
      });
    });

    return this.findAdminShortlistById(shortlistId, currentUser);
  }

  /**
   * Remove item from shortlist.
   */
  async removeItem(
    shortlistId: string,
    talentId: string,
    currentUser: AuthenticatedUser,
  ): Promise<AdminShortlistResponseDto> {
    const item = await this.prisma.shortlistItems.findUnique({
      where: { shortlistId_talentId: { shortlistId, talentId } },
    });
    if (!item) {
      throw new NotFoundException(`Shortlist item not found`);
    }

    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.shortlistItems.delete({
        where: { shortlistId_talentId: { shortlistId, talentId } },
      });
    });

    return this.findAdminShortlistById(shortlistId, currentUser);
  }

  /**
   * Publish shortlist to client portal.
   * Generates secure share token, marks status = published, sets firstShortlistAt on request, transitions request status to shortlist_sent.
   */
  async publishShortlist(
    shortlistId: string,
    currentUser: AuthenticatedUser,
  ): Promise<{ shortlist: AdminShortlistResponseDto; shareToken: string; shareUrl: string }> {
    const shortlist = await this.prisma.shortlists.findUnique({
      where: { id: shortlistId },
    });

    if (!shortlist) {
      throw new NotFoundException(`Shortlist ${shortlistId} not found`);
    }

    const items = await this.prisma.shortlistItems.findMany({
      where: { shortlistId },
    });

    if (items.length === 0) {
      throw new BadRequestException("Cannot publish an empty shortlist. Add at least one talent profile.");
    }

    const request = await this.prisma.talentRequests.findUnique({
      where: { id: shortlist.requestId },
    });
    if (!request) {
      throw new NotFoundException(`Talent request ${shortlist.requestId} not found`);
    }

    // Generate secure share token & hash
    const rawToken = crypto.randomBytes(24).toString("hex");
    const shareTokenHash = this.hashToken(rawToken);
    const now = new Date();
    const shareExpiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days valid

    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.shortlists.update({
        where: { id: shortlistId },
        data: {
          status: ShortlistStatus.published,
          publishedAt: now,
          publishedBy: currentUser.id,
          shareTokenHash,
          shareExpiresAt,
        },
      });

      // Update Talent Request status and firstShortlistAt if first time
      const requestUpdateData: Prisma.TalentRequestsUpdateInput = {
        status: RequestStatus.shortlist_sent,
      };
      if (!request.firstShortlistAt) {
        requestUpdateData.firstShortlistAt = now;
      }

      await tx.talentRequests.update({
        where: { id: shortlist.requestId },
        data: requestUpdateData,
      });
    });

    const updatedShortlist = await this.findAdminShortlistById(shortlistId, currentUser);
    const shareUrl = `/api/v1/public/shortlists/share/${rawToken}`;

    return {
      shortlist: updatedShortlist,
      shareToken: rawToken,
      shareUrl,
    };
  }

  /**
   * Find shortlist by ID for Admin/Recruiter (full view with names, emails, pay).
   */
  async findAdminShortlistById(
    shortlistId: string,
    currentUser: AuthenticatedUser,
  ): Promise<AdminShortlistResponseDto> {
    const shortlist = await this.prisma.shortlists.findUnique({
      where: { id: shortlistId },
    });

    if (!shortlist) {
      throw new NotFoundException(`Shortlist ${shortlistId} not found`);
    }

    const items = await this.prisma.shortlistItems.findMany({
      where: { shortlistId },
      orderBy: { sortOrder: "asc" },
    });

    const talentIds = items.map((i) => i.talentId);
    const talents = talentIds.length > 0
      ? await this.prisma.talents.findMany({
          where: { id: { in: talentIds } },
        })
      : [];
    const talentMap = new Map(talents.map((t) => [t.id, t]));

    return {
      id: shortlist.id,
      requestId: shortlist.requestId,
      version: shortlist.version,
      status: shortlist.status,
      publishedAt: shortlist.publishedAt ? shortlist.publishedAt.toISOString() : null,
      shareExpiresAt: shortlist.shareExpiresAt ? shortlist.shareExpiresAt.toISOString() : null,
      shareUrl: shortlist.shareTokenHash ? `/api/v1/public/shortlists/share/...` : null,
      items: items.map((item) => {
        const talent = talentMap.get(item.talentId);
        return {
          id: item.id,
          talentId: item.talentId,
          talentFullName: talent ? `${talent.firstName} ${talent.lastName}` : "Unknown",
          talentEmail: talent ? talent.email : "",
          publicSlug: talent?.publicSlug || `talent-${item.talentId.slice(0, 8)}`,
          roleTitle: talent?.headline,
          seniority: talent?.seniority,
          matchScore: item.matchScore ? Number(item.matchScore) : null,
          matchBreakdown: item.matchBreakdown,
          recruiterNote: item.recruiterNote,
          proposedClientPrice: item.proposedClientPrice ? item.proposedClientPrice.toFixed(2) : null,
          proposedCurrency: item.proposedCurrency,
          agreedTalentPay: talent?.agreedPay ? talent.agreedPay.toFixed(2) : null,
          talentResponse: item.talentResponse,
          talentRespondedAt: item.talentRespondedAt ? item.talentRespondedAt.toISOString() : null,
          talentDeclineReason: item.talentDeclineReason,
          clientDecision: item.clientDecision,
          clientDecisionReason: item.clientDecisionReason,
          clientComment: item.clientComment,
          clientDecidedAt: item.clientDecidedAt ? item.clientDecidedAt.toISOString() : null,
          sortOrder: item.sortOrder,
        };
      }),
      createdAt: shortlist.createdAt ? shortlist.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: shortlist.updatedAt ? shortlist.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Find shortlist by ID for Client Portal (FR-SEC-01 strictly anonymised).
   * Strips real name, email, phone, agreed pay, and margin!
   */
  async findClientShortlistById(
    shortlistId: string,
    currentUser: AuthenticatedUser,
  ): Promise<ClientShortlistResponseDto> {
    const shortlist = await this.prisma.shortlists.findUnique({
      where: { id: shortlistId },
    });

    if (!shortlist) {
      throw new NotFoundException(`Shortlist ${shortlistId} not found`);
    }

    const request = await this.prisma.talentRequests.findUnique({
      where: { id: shortlist.requestId },
    });

    if (!request) {
      throw new NotFoundException(`Talent request ${shortlist.requestId} not found`);
    }

    // Client scope enforcement
    if (request.companyId !== currentUser.companyId) {
      throw new ForbiddenException("Access to this shortlist is denied");
    }

    return this.mapToAnonymisedShortlist(shortlist, request);
  }

  /**
   * Find shortlist by public secret token link (FR-SEC-01 strictly anonymised).
   */
  async findPublicShortlistByToken(token: string): Promise<ClientShortlistResponseDto> {
    const tokenHash = this.hashToken(token);
    const shortlist = await this.prisma.shortlists.findFirst({
      where: { shareTokenHash: tokenHash },
    });

    if (!shortlist) {
      throw new NotFoundException("Shortlist link is invalid or has expired");
    }

    if (shortlist.shareExpiresAt && shortlist.shareExpiresAt < new Date()) {
      throw new ForbiddenException("This shortlist link has expired");
    }

    const request = await this.prisma.talentRequests.findUnique({
      where: { id: shortlist.requestId },
    });

    if (!request) {
      throw new NotFoundException(`Talent request ${shortlist.requestId} not found`);
    }

    return this.mapToAnonymisedShortlist(shortlist, request);
  }

  /**
   * Client records decision for a shortlisted profile (interview, not_a_fit, hire).
   */
  async recordClientDecision(
    shortlistId: string,
    talentId: string,
    dto: ShortlistClientDecisionDto,
    currentUser: AuthenticatedUser,
  ): Promise<ClientShortlistResponseDto> {
    const shortlist = await this.prisma.shortlists.findUnique({
      where: { id: shortlistId },
    });

    if (!shortlist) {
      throw new NotFoundException(`Shortlist ${shortlistId} not found`);
    }

    const request = await this.prisma.talentRequests.findUnique({
      where: { id: shortlist.requestId },
    });

    if (!request) {
      throw new NotFoundException(`Talent request ${shortlist.requestId} not found`);
    }

    // Scope check: must belong to client company
    if (request.companyId !== currentUser.companyId) {
      throw new ForbiddenException("Access to this shortlist is denied");
    }

    let item = await this.prisma.shortlistItems.findUnique({
      where: { shortlistId_talentId: { shortlistId, talentId } },
    });

    if (!item) {
      try {
        item = await this.prisma.shortlistItems.findUnique({
          where: { id: talentId },
        });
      } catch {
        // ignore
      }
    }

    if (!item || item.shortlistId !== shortlistId) {
      throw new NotFoundException(`Shortlist item for talent ${talentId} not found`);
    }

    if (dto.decision === ClientDecision.not_a_fit && !dto.reason) {
      throw new BadRequestException("clientDecisionReason is required when marking a candidate as not_a_fit");
    }

    const now = new Date();
    await this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.shortlistItems.update({
        where: { id: item!.id },
        data: {
          clientDecision: dto.decision,
          clientDecisionReason: dto.decision === ClientDecision.not_a_fit ? dto.reason : null,
          clientComment: dto.comment,
          clientDecidedBy: currentUser.id,
          clientDecidedAt: now,
          // FR-SEC-01: contact revealed once interview is decided/booked
          contactRevealedAt: dto.decision === ClientDecision.interview ? now : item!.contactRevealedAt,
        },
      });

      // If client chose interview or hire, update talent request status if currently shortlist_sent
      if (
        (dto.decision === ClientDecision.interview || dto.decision === ClientDecision.hire) &&
        request.status === RequestStatus.shortlist_sent
      ) {
        await tx.talentRequests.update({
          where: { id: shortlist.requestId },
          data: {
            status: RequestStatus.interviewing,
          },
        });
      }
    });

    return this.findClientShortlistById(shortlistId, currentUser);
  }

  /**
   * Public decision recording via share token (FR-SEC-01).
   */
  async recordPublicDecision(
    token: string,
    talentIdOrItemId: string,
    dto: ShortlistClientDecisionDto,
  ): Promise<ClientShortlistResponseDto> {
    const tokenHash = this.hashToken(token);
    const shortlist = await this.prisma.shortlists.findFirst({
      where: { shareTokenHash: tokenHash },
    });

    if (!shortlist) {
      throw new NotFoundException("Shortlist link is invalid or has expired");
    }

    if (shortlist.shareExpiresAt && shortlist.shareExpiresAt < new Date()) {
      throw new ForbiddenException("This shortlist link has expired");
    }

    const request = await this.prisma.talentRequests.findUnique({
      where: { id: shortlist.requestId },
    });

    if (!request) {
      throw new NotFoundException(`Talent request ${shortlist.requestId} not found`);
    }

    let item = await this.prisma.shortlistItems.findUnique({
      where: { shortlistId_talentId: { shortlistId: shortlist.id, talentId: talentIdOrItemId } },
    });

    if (!item) {
      try {
        item = await this.prisma.shortlistItems.findUnique({
          where: { id: talentIdOrItemId },
        });
      } catch {
        // ignore
      }
    }

    if (!item || item.shortlistId !== shortlist.id) {
      throw new NotFoundException(`Shortlist item ${talentIdOrItemId} not found`);
    }

    if (dto.decision === ClientDecision.not_a_fit && !dto.reason) {
      throw new BadRequestException("clientDecisionReason is required when marking a candidate as not_a_fit");
    }

    const now = new Date();
    await this.prisma.shortlistItems.update({
      where: { id: item.id },
      data: {
        clientDecision: dto.decision,
        clientDecisionReason: dto.decision === ClientDecision.not_a_fit ? dto.reason : null,
        clientComment: dto.comment,
        clientDecidedAt: now,
        contactRevealedAt: dto.decision === ClientDecision.interview ? now : item.contactRevealedAt,
      },
    });

    if (
      (dto.decision === ClientDecision.interview || dto.decision === ClientDecision.hire) &&
      request.status === RequestStatus.shortlist_sent
    ) {
      await this.prisma.talentRequests.update({
        where: { id: shortlist.requestId },
        data: {
          status: RequestStatus.interviewing,
        },
      });
    }

    return this.mapToAnonymisedShortlist(shortlist, request);
  }

  /**
   * Helper to format anonymised shortlist (FR-SEC-01).
   */
  private async mapToAnonymisedShortlist(shortlist: any, request: any): Promise<ClientShortlistResponseDto> {
    const items = await this.prisma.shortlistItems.findMany({
      where: { shortlistId: shortlist.id },
      orderBy: { sortOrder: "asc" },
    });

    const talentIds = items.map((i) => i.talentId);
    const [talents, allSkills, allLanguages] = await Promise.all([
      talentIds.length > 0
        ? this.prisma.talents.findMany({ where: { id: { in: talentIds } } })
        : [],
      talentIds.length > 0
        ? this.prisma.talentSkills.findMany({ where: { talentId: { in: talentIds } } })
        : [],
      talentIds.length > 0
        ? this.prisma.talentLanguages.findMany({ where: { talentId: { in: talentIds } } })
        : [],
    ]);

    const talentMap = new Map(talents.map((t) => [t.id, t]));

    // Taxonomy skills lookup
    const allSkillIds = allSkills.map((s) => s.skillId);
    const taxonomySkills = allSkillIds.length > 0
      ? await this.prisma.skills.findMany({
          where: { id: { in: allSkillIds } },
          select: { id: true, name: true },
        })
      : [];
    const skillNameMap = new Map(taxonomySkills.map((s) => [s.id, s.name]));

    const skillsByTalent = new Map<string, string[]>();
    for (const s of allSkills) {
      const arr = skillsByTalent.get(s.talentId) || [];
      arr.push(skillNameMap.get(s.skillId) || "Skill");
      skillsByTalent.set(s.talentId, arr);
    }

    const languagesByTalent = new Map<string, string[]>();
    for (const l of allLanguages) {
      const arr = languagesByTalent.get(l.talentId) || [];
      arr.push(`${l.languageCode.toUpperCase()} (${l.level})`);
      languagesByTalent.set(l.talentId, arr);
    }

    const anonymisedItems: AnonymisedShortlistItemDto[] = items.map((item) => {
      const talent = talentMap.get(item.talentId);
      return {
        id: item.id,
        talentId: item.talentId,
        publicSlug: talent?.publicSlug || `talent-${item.talentId.slice(0, 8)}`,
        roleTitle: talent?.headline,
        seniority: talent?.seniority,
        experienceYears: talent?.yearsExperience ? Number(talent.yearsExperience) : null,
        city: talent?.city,
        countryCode: talent?.countryCode,
        bio: talent?.summary,
        skills: skillsByTalent.get(item.talentId) || [],
        languages: languagesByTalent.get(item.talentId) || [],
        matchScore: item.matchScore ? Number(item.matchScore) : null,
        recruiterNote: item.recruiterNote,
        proposedClientPrice: item.proposedClientPrice ? item.proposedClientPrice.toFixed(2) : null,
        proposedCurrency: item.proposedCurrency,
        clientDecision: item.clientDecision,
        clientDecisionReason: item.clientDecisionReason,
        clientComment: item.clientComment,
        sortOrder: item.sortOrder,
      };
    });

    return {
      id: shortlist.id,
      requestId: shortlist.requestId,
      roleTitle: request.roleTitle,
      version: shortlist.version,
      status: shortlist.status,
      publishedAt: shortlist.publishedAt ? shortlist.publishedAt.toISOString() : null,
      items: anonymisedItems,
    };
  }

  /**
   * Generates a valid minimal PDF binary buffer for an anonymised shortlist (FR-SEC-01).
   */
  async generateAnonymisedPdf(
    shortlistId: string,
    currentUser: AuthenticatedUser,
  ): Promise<Buffer> {
    const shortlist = await this.prisma.shortlists.findUnique({
      where: { id: shortlistId },
    });

    if (!shortlist) {
      throw new NotFoundException(`Shortlist ${shortlistId} not found`);
    }

    const request = await this.prisma.talentRequests.findUnique({
      where: { id: shortlist.requestId },
    });

    if (!request) {
      throw new NotFoundException(`Talent request ${shortlist.requestId} not found`);
    }

    if (
      (currentUser.role === UserRole.client_admin || currentUser.role === UserRole.client_user) &&
      request.companyId !== currentUser.companyId
    ) {
      throw new ForbiddenException("Access to this shortlist is denied");
    }

    const clientShortlist = await this.mapToAnonymisedShortlist(shortlist, request);

    const textLines: string[] = [
      "CODERS HUB - CANDIDATE SHORTLIST",
      "==================================",
      `Request Role: ${clientShortlist.roleTitle || "Talent Request"} (v${clientShortlist.version})`,
      `Shortlist ID: ${clientShortlist.id}`,
      `Published: ${clientShortlist.publishedAt ?? "Draft"}`,
      "",
      "SELECTED CANDIDATES (ANONYMISED PROFILES)",
      "------------------------------------------",
    ];

    clientShortlist.items.forEach((item, idx) => {
      textLines.push(`${idx + 1}. Candidate: ${item.publicSlug}`);
      textLines.push(`   Title: ${item.roleTitle || "Software Engineer"} | Seniority: ${item.seniority || "Mid"}`);
      if (item.experienceYears) textLines.push(`   Experience: ${item.experienceYears} years`);
      if (item.skills.length > 0) textLines.push(`   Key Skills: ${item.skills.slice(0, 8).join(", ")}`);
      if (item.recruiterNote) textLines.push(`   Recruiter Note: ${item.recruiterNote}`);
      if (item.proposedClientPrice) {
        textLines.push(`   Indicative Price: ${item.proposedClientPrice} ${item.proposedCurrency ?? "EUR"}/month`);
      }
      textLines.push("");
    });

    return this.renderSimplePdf(textLines);
  }

  private renderSimplePdf(lines: string[]): Buffer {
    let streamContent = "BT\n/F1 12 Tf\n50 750 Td\n15 TL\n";
    for (const line of lines) {
      const sanitized = line.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      streamContent += `(${sanitized}) '\n`;
    }
    streamContent += "ET";

    const streamLength = Buffer.byteLength(streamContent, "utf-8");

    const pdfObjects = [
      "%PDF-1.4",
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj",
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`,
      `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj`,
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj",
    ];

    let offset = 0;
    const offsets: number[] = [];
    let body = "";

    for (let i = 0; i < pdfObjects.length; i++) {
      if (i > 0) {
        offsets.push(offset);
      }
      body += pdfObjects[i] + "\n";
      offset = Buffer.byteLength(body, "utf-8");
    }

    const startXref = offset;
    let xref = `xref\n0 ${pdfObjects.length}\n0000000000 65535 f \n`;
    for (const off of offsets) {
      xref += off.toString().padStart(10, "0") + " 00000 n \n";
    }

    const trailer = `trailer\n<< /Size ${pdfObjects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;
    return Buffer.from(body + xref + trailer, "utf-8");
  }
}
