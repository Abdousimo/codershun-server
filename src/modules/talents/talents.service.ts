import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import {
  Prisma,
  Recommendation,
  SeniorityLevel,
  TalentStatus,
  VettingStage,
  VettingStepStatus,
  VettingStepType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { toDecimal } from "../../common/utils/money";
import { QueryShowcaseDto, QueryTalentsDto } from "./dto/query-talents.dto";
import {
  ApproveTalentDto,
  BlacklistTalentDto,
  CreateTalentProfileDto,
  RejectTalentDto,
  UpdateTalentProfileDto,
  UpdateTalentStageDto,
} from "./dto/talent-profile.dto";
import { CreateScorecardDto } from "./dto/scorecard.dto";
import {
  CreateCertificationDto,
  CreateEducationDto,
  CreateExperienceDto,
  CreatePortfolioDto,
} from "./dto/experience-education.dto";
import {
  TalentAdminResponseDto,
  TalentShowcaseResponseDto,
} from "./dto/talent-response.dto";

@Injectable()
export class TalentsService {
  private readonly logger = new Logger(TalentsService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==========================================
  // CANDIDATE PROFILE CRUD & ATS
  // ==========================================

  async getTalents(query: QueryTalentsDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize || 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.TalentsWhereInput = {
      deletedAt: null,
      ...(query.stage && { vettingStage: query.stage }),
      ...(query.status && { status: query.status }),
      ...(query.seniority && { seniority: query.seniority }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.jobRoleId && { jobRoleId: query.jobRoleId }),
      ...(query.isAvailable && { status: TalentStatus.available }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
          { lastName: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
          { email: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
          { headline: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.talents.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.talents.count({ where }),
    ]);

    return {
      data: data.map((t) => this.mapToAdminResponse(t)),
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getTalentsKanban() {
    const stages = Object.values(VettingStage);
    const talents = await this.prisma.talents.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    const kanban: Record<VettingStage, TalentAdminResponseDto[]> = {} as any;
    for (const stage of stages) {
      kanban[stage] = [];
    }

    for (const t of talents) {
      kanban[t.vettingStage].push(this.mapToAdminResponse(t));
    }

    return kanban;
  }

  async getTalentById(id: string) {
    const talent = await this.prisma.talents.findFirst({
      where: { id, deletedAt: null },
    });

    if (!talent) {
      throw new NotFoundException(`Talent ${id} not found`);
    }

    const [skills, languages, experiences, educations, certifications, portfolio, references, documents, vettingSteps] =
      await Promise.all([
        this.prisma.talentSkills.findMany({ where: { talentId: id } }),
        this.prisma.talentLanguages.findMany({ where: { talentId: id } }),
        this.prisma.talentExperiences.findMany({ where: { talentId: id }, orderBy: { startDate: "desc" } }),
        this.prisma.talentEducations.findMany({ where: { talentId: id } }),
        this.prisma.talentCertifications.findMany({ where: { talentId: id } }),
        this.prisma.talentPortfolioItems.findMany({ where: { talentId: id } }),
        this.prisma.talentReferences.findMany({ where: { talentId: id } }),
        this.prisma.talentDocuments.findMany({ where: { talentId: id } }),
        this.prisma.vettingSteps.findMany({ where: { talentId: id }, orderBy: { createdAt: "asc" } }),
      ]);

    return {
      ...this.mapToAdminResponse(talent),
      skills,
      languages,
      experiences,
      educations,
      certifications,
      portfolio,
      references,
      documents,
      vettingSteps,
    };
  }

  async createTalent(dto: CreateTalentProfileDto, currentUser: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();

    // Check duplicate by email (FR-TAL-03)
    const existing = await this.prisma.talents.findFirst({
      where: { email: { equals: email, mode: Prisma.QueryMode.insensitive }, deletedAt: null },
    });

    if (existing) {
      if (existing.isBlacklisted) {
        throw new BadRequestException("Candidate is blacklisted and cannot be registered");
      }
      if (existing.canReapplyAfter && new Date() < existing.canReapplyAfter) {
        throw new BadRequestException(
          `Candidate re-application waiting period active until ${existing.canReapplyAfter.toISOString().split("T")[0]}`,
        );
      }
      throw new BadRequestException(`Candidate with email ${dto.email} already exists`);
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const talent = await tx.talents.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email,
          phone: dto.phone,
          whatsapp: dto.whatsapp ?? dto.phone,
          city: dto.city,
          countryCode: dto.countryCode?.toUpperCase() ?? "DZ",
          categoryId: dto.categoryId,
          jobRoleId: dto.jobRoleId,
          headline: dto.headline,
          seniority: dto.seniority,
          yearsExperience: dto.yearsExperience ? toDecimal(dto.yearsExperience) : null,
          expectedPay: dto.expectedPay ? toDecimal(dto.expectedPay) : null,
          payCurrency: dto.payCurrency ?? "EUR",
          availabilityDate: dto.availabilityDate ? new Date(dto.availabilityDate) : null,
          noticePeriodDays: dto.noticePeriodDays ?? 0,
          timeSharePct: dto.timeSharePct ?? 100,
          linkedinUrl: dto.linkedinUrl,
          githubUrl: dto.githubUrl,
          recruiterId: dto.recruiterId ?? currentUser.id,
          vettingStage: VettingStage.applied,
          status: TalentStatus.in_vetting,
          createdBy: currentUser.id,
        },
      });

      // Initialize first vetting step
      await tx.vettingSteps.create({
        data: {
          talentId: talent.id,
          type: VettingStepType.cv_screening,
          status: VettingStepStatus.pending,
          createdBy: currentUser.id,
        },
      });

      return this.mapToAdminResponse(talent);
    });
  }

  async updateTalent(id: string, dto: UpdateTalentProfileDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(id);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.talents.update({
        where: { id },
        data: {
          ...(dto.firstName !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName !== undefined && { lastName: dto.lastName }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.whatsapp !== undefined && { whatsapp: dto.whatsapp }),
          ...(dto.city !== undefined && { city: dto.city }),
          ...(dto.headline !== undefined && { headline: dto.headline }),
          ...(dto.summary !== undefined && { summary: dto.summary }),
          ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
          ...(dto.jobRoleId !== undefined && { jobRoleId: dto.jobRoleId }),
          ...(dto.seniority !== undefined && { seniority: dto.seniority }),
          ...(dto.yearsExperience !== undefined && {
            yearsExperience: dto.yearsExperience ? toDecimal(dto.yearsExperience) : null,
          }),
          ...(dto.expectedPay !== undefined && {
            expectedPay: dto.expectedPay ? toDecimal(dto.expectedPay) : null,
          }),
          ...(dto.currentPay !== undefined && {
            currentPay: dto.currentPay ? toDecimal(dto.currentPay) : null,
          }),
          ...(dto.agreedPay !== undefined && {
            agreedPay: dto.agreedPay ? toDecimal(dto.agreedPay) : null,
          }),
          ...(dto.availabilityDate !== undefined && {
            availabilityDate: dto.availabilityDate ? new Date(dto.availabilityDate) : null,
          }),
          ...(dto.noticePeriodDays !== undefined && { noticePeriodDays: dto.noticePeriodDays }),
          ...(dto.timeSharePct !== undefined && { timeSharePct: dto.timeSharePct }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.recruiterId !== undefined && { recruiterId: dto.recruiterId }),
          updatedAt: new Date(),
        },
      });

      return this.mapToAdminResponse(updated);
    });
  }

  // ==========================================
  // VETTING STAGES & APPROVAL (CDC 6.1)
  // ==========================================

  async changeTalentStage(id: string, dto: UpdateTalentStageDto, currentUser: AuthenticatedUser) {
    const talent = await this.getTalentById(id);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.talents.update({
        where: { id },
        data: {
          vettingStage: dto.stage,
          updatedAt: new Date(),
        },
      });

      // Map vetting stage to step type
      const stepTypeMap: Partial<Record<VettingStage, VettingStepType>> = {
        [VettingStage.screening]: VettingStepType.cv_screening,
        [VettingStage.hr_interview]: VettingStepType.hr_call,
        [VettingStage.technical_test]: VettingStepType.technical_test,
        [VettingStage.tech_interview]: VettingStepType.technical_interview,
        [VettingStage.references]: VettingStepType.reference_check,
      };

      const stepType = stepTypeMap[dto.stage];
      if (stepType) {
        const existingStep = await tx.vettingSteps.findFirst({
          where: { talentId: id, type: stepType },
        });

        if (!existingStep) {
          await tx.vettingSteps.create({
            data: {
              talentId: id,
              type: stepType,
              status: VettingStepStatus.in_progress,
              notes: dto.notes,
              createdBy: currentUser.id,
            },
          });
        }
      }

      return this.mapToAdminResponse(updated);
    });
  }

  async submitScorecard(talentId: string, dto: CreateScorecardDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(talentId);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      // Find or create current technical interview vetting step
      let stepId = dto.vettingStepId;
      if (!stepId) {
        const step = await tx.vettingSteps.findFirst({
          where: { talentId, type: VettingStepType.technical_interview },
          orderBy: { createdAt: "desc" },
        });
        if (step) {
          stepId = step.id;
        } else {
          const newStep = await tx.vettingSteps.create({
            data: {
              talentId,
              type: VettingStepType.technical_interview,
              status: VettingStepStatus.passed,
              completedAt: new Date(),
              createdBy: currentUser.id,
            },
          });
          stepId = newStep.id;
        }
      }

      const totalScoreDecimal = toDecimal(dto.totalScore);

      const scorecard = await tx.scorecards.upsert({
        where: {
          vettingStepId_reviewerId: {
            vettingStepId: stepId,
            reviewerId: dto.reviewerId ?? currentUser.id,
          },
        },
        create: {
          vettingStepId: stepId,
          reviewerId: dto.reviewerId ?? currentUser.id,
          totalScore: totalScoreDecimal,
          recommendation: dto.recommendation,
          strengths: dto.strengths,
          concerns: dto.concerns,
        },
        update: {
          totalScore: totalScoreDecimal,
          recommendation: dto.recommendation,
          strengths: dto.strengths,
          concerns: dto.concerns,
          submittedAt: new Date(),
        },
      });

      // Insert scorecard scores
      if (dto.scores && dto.scores.length > 0) {
        await tx.scorecardScores.deleteMany({ where: { scorecardId: scorecard.id } });
        for (const s of dto.scores) {
          await tx.scorecardScores.create({
            data: {
              scorecardId: scorecard.id,
              criterion: s.criterion,
              skillId: s.skillId,
              score: s.score,
              comment: s.comment,
            },
          });
        }
      }

      // Update talent's vettingScore
      await tx.talents.update({
        where: { id: talentId },
        data: {
          vettingScore: totalScoreDecimal,
          updatedAt: new Date(),
        },
      });

      return scorecard;
    });
  }

  /**
   * Recruiter lead approval (CDC §6.1 Step 7).
   * Sets seniority, agreed pay, generates public showcase pseudonym & slug, and transitions to Vetted / Available.
   */
  async approveTalent(id: string, dto: ApproveTalentDto, currentUser: AuthenticatedUser) {
    const talent = await this.getTalentById(id);

    const displayName = dto.publicDisplayName || `${talent.firstName} ${talent.lastName.charAt(0)}.`;
    const sanitizedName = displayName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const publicSlug = `${sanitizedName}-${id.slice(0, 8)}`;

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.talents.update({
        where: { id },
        data: {
          vettingStage: VettingStage.vetted,
          status: TalentStatus.available,
          seniority: dto.seniority,
          agreedPay: toDecimal(dto.agreedPay),
          vettedAt: new Date(),
          vettedBy: currentUser.id,
          showcasePublished: dto.showcasePublished ?? false,
          showcaseOptIn: dto.showcasePublished ? true : talent.showcaseOptIn,
          showcaseConsentAt: dto.showcasePublished ? new Date() : talent.showcaseConsentAt ? new Date(talent.showcaseConsentAt) : null,
          publicDisplayName: displayName,
          publicSlug,
          updatedAt: new Date(),
        },
      });

      return this.mapToAdminResponse(updated);
    });
  }

  /**
   * Rejects applicant (enforcing Rule FR-TAL-03: 6-month reapply delay).
   */
  async rejectTalent(id: string, dto: RejectTalentDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(id);

    const now = new Date();
    // Default 6 months delay (FR-TAL-03)
    let reapplyDate: Date;
    if (dto.canReapplyAfter) {
      reapplyDate = new Date(dto.canReapplyAfter);
    } else {
      reapplyDate = new Date(now);
      reapplyDate.setMonth(reapplyDate.getMonth() + 6);
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.talents.update({
        where: { id },
        data: {
          vettingStage: VettingStage.rejected,
          status: TalentStatus.inactive,
          rejectedAt: now,
          rejectCategory: dto.rejectCategory,
          rejectReason: dto.rejectReason,
          canReapplyAfter: reapplyDate,
          updatedAt: now,
        },
      });

      return this.mapToAdminResponse(updated);
    });
  }

  /**
   * Blacklists applicant for serious breaches.
   */
  async blacklistTalent(id: string, dto: BlacklistTalentDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(id);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.talents.update({
        where: { id },
        data: {
          isBlacklisted: true,
          blacklistReason: dto.blacklistReason,
          status: TalentStatus.blacklisted,
          showcasePublished: false,
          updatedAt: new Date(),
        },
      });

      return this.mapToAdminResponse(updated);
    });
  }

  // ==========================================
  // PUBLIC SHOWCASE (FR-TAL-04, FR-SEC-01)
  // ==========================================

  /**
   * Retrieves vetted public talent profiles.
   * Enforces:
   *  - FR-TAL-04: Only talents with vettingStage = 'vetted', showcaseOptIn = true, showcaseConsentAt != null.
   *  - FR-SEC-01: Anonymised profiles; hides email, phone, personal pay, margins.
   */
  async getPublicShowcase(query: QueryShowcaseDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(50, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.TalentsWhereInput = {
      deletedAt: null,
      isBlacklisted: false,
      vettingStage: VettingStage.vetted,
      showcaseOptIn: true,
      showcaseConsentAt: { not: null },
      showcasePublished: true,
      ...(query.seniority && { seniority: query.seniority }),
      ...(query.categoryId && { categoryId: query.categoryId }),
      ...(query.jobRoleId && { jobRoleId: query.jobRoleId }),
    };

    const [data, total] = await Promise.all([
      this.prisma.talents.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { vettingScore: "desc" },
      }),
      this.prisma.talents.count({ where }),
    ]);

    // Enrich with anonymised skills & experiences
    const talentIds = data.map((t) => t.id);
    const [skills, languages, experiences] = await Promise.all([
      this.prisma.talentSkills.findMany({ where: { talentId: { in: talentIds } } }),
      this.prisma.talentLanguages.findMany({ where: { talentId: { in: talentIds } } }),
      this.prisma.talentExperiences.findMany({
        where: { talentId: { in: talentIds } },
        orderBy: { startDate: "desc" },
      }),
    ]);

    const showcaseList: TalentShowcaseResponseDto[] = data.map((t) => {
      const tSkills = skills.filter((s) => s.talentId === t.id).map((s) => s.skillId);
      const tLangs = languages.filter((l) => l.talentId === t.id).map((l) => ({ code: l.languageCode, level: l.level }));
      const tExps = experiences
        .filter((e) => e.talentId === t.id)
        .map((e) => ({
          companyLabel: e.hideCompanyName ? (e.publicCompanyLabel || "Confidential Company") : e.companyName,
          title: e.title,
          startDate: e.startDate.toISOString().split("T")[0],
          endDate: e.endDate ? e.endDate.toISOString().split("T")[0] : null,
          description: e.description,
          technologies: e.technologies,
        }));

      return {
        id: t.id,
        publicSlug: t.publicSlug || `talent-${t.id.slice(0, 8)}`,
        displayName: t.publicDisplayName || `${t.firstName} ${t.lastName.charAt(0)}.`,
        headline: t.headline,
        seniority: t.seniority,
        yearsExperience: t.yearsExperience ? t.yearsExperience.toString() : null,
        vettingScore: t.vettingScore ? t.vettingScore.toString() : null,
        availabilityDate: t.availabilityDate ? t.availabilityDate.toISOString().split("T")[0] : null,
        skills: tSkills,
        languages: tLangs,
        experiences: tExps,
      };
    });

    return {
      data: showcaseList,
      meta: {
        page,
        pageSize,
        total,
      },
    };
  }

  // ==========================================
  // EXPERIENCES, EDUCATIONS, PORTFOLIO
  // ==========================================

  async addExperience(talentId: string, dto: CreateExperienceDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(talentId);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.talentExperiences.create({
        data: {
          talentId,
          companyName: dto.companyName,
          publicCompanyLabel: dto.publicCompanyLabel,
          hideCompanyName: dto.hideCompanyName ?? true,
          title: dto.title,
          countryCode: dto.countryCode?.toUpperCase(),
          isRemote: dto.isRemote ?? true,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          description: dto.description,
          technologies: dto.technologies ?? [],
        },
      });
    });
  }

  async addEducation(talentId: string, dto: CreateEducationDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(talentId);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.talentEducations.create({
        data: {
          talentId,
          institution: dto.institution,
          degree: dto.degree,
          fieldOfStudy: dto.fieldOfStudy,
          startYear: dto.startYear,
          endYear: dto.endYear,
        },
      });
    });
  }

  async addCertification(talentId: string, dto: CreateCertificationDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(talentId);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.talentCertifications.create({
        data: {
          talentId,
          name: dto.name,
          issuer: dto.issuer,
          issuedOn: dto.issuedOn ? new Date(dto.issuedOn) : null,
          expiresOn: dto.expiresOn ? new Date(dto.expiresOn) : null,
          credentialUrl: dto.credentialUrl,
        },
      });
    });
  }

  async addPortfolioItem(talentId: string, dto: CreatePortfolioDto, currentUser: AuthenticatedUser) {
    await this.getTalentById(talentId);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.talentPortfolioItems.create({
        data: {
          talentId,
          title: dto.title,
          url: dto.url,
          fileId: dto.fileId,
          description: dto.description,
          isPublic: dto.isPublic ?? true,
        },
      });
    });
  }

  // ==========================================
  // RESPONSE MAPPERS
  // ==========================================

  private mapToAdminResponse(talent: any): TalentAdminResponseDto {
    return {
      id: talent.id,
      userId: talent.userId,
      firstName: talent.firstName,
      lastName: talent.lastName,
      email: talent.email,
      phone: talent.phone,
      whatsapp: talent.whatsapp,
      city: talent.city,
      countryCode: talent.countryCode,
      headline: talent.headline,
      summary: talent.summary,
      seniority: talent.seniority,
      yearsExperience: talent.yearsExperience ? talent.yearsExperience.toString() : null,
      expectedPay: talent.expectedPay ? (talent.expectedPay.toFixed ? talent.expectedPay.toFixed(2) : talent.expectedPay.toString()) : null,
      currentPay: talent.currentPay ? (talent.currentPay.toFixed ? talent.currentPay.toFixed(2) : talent.currentPay.toString()) : null,
      agreedPay: talent.agreedPay ? (talent.agreedPay.toFixed ? talent.agreedPay.toFixed(2) : talent.agreedPay.toString()) : null,
      vettingStage: talent.vettingStage,
      status: talent.status,
      vettingScore: talent.vettingScore ? talent.vettingScore.toString() : null,
      isBlacklisted: talent.isBlacklisted,
      blacklistReason: talent.blacklistReason,
      canReapplyAfter: talent.canReapplyAfter ? talent.canReapplyAfter.toISOString().split("T")[0] : null,
      showcaseOptIn: talent.showcaseOptIn,
      showcaseConsentAt: talent.showcaseConsentAt ? talent.showcaseConsentAt.toISOString() : null,
      showcasePublished: talent.showcasePublished,
      publicSlug: talent.publicSlug,
      publicDisplayName: talent.publicDisplayName,
      createdAt: talent.createdAt.toISOString(),
      updatedAt: talent.updatedAt.toISOString(),
    };
  }
}
