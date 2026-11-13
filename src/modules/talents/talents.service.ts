import { BadRequestException, Inject, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";

import {
  DocumentType,
  Prisma,
  Recommendation,
  SeniorityLevel,
  SkillLevel,
  TalentStatus,
  UserRole,
  VettingStage,
  VettingStepStatus,
  VettingStepType,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FilesService } from "../files/files.service";
import { FileCategory } from "../files/dto/upload-file.dto";
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
import { CreateCertificationDto, CreateEducationDto, CreateExperienceDto, CreatePortfolioDto } from "./dto/experience-education.dto";
import { TalentAdminResponseDto, TalentShowcaseResponseDto } from "./dto/talent-response.dto";
import { SubmitTalentApplicationDto } from "./dto/submit-talent-application.dto";

@Injectable()
export class TalentsService {
  private readonly logger = new Logger(TalentsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() @Inject(FilesService) private readonly filesService?: FilesService,
  ) {}

  // ==========================================
  // CANDIDATE PROFILE CRUD & ATS
  // ==========================================

  async getTalents(query: QueryTalentsDto) {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize || query.limit || 25));
    const skip = (page - 1) * pageSize;

    let stageFilter = query.stage;
    if ((stageFilter as any) === "screened" || (stageFilter as any) === "screening") {
      stageFilter = VettingStage.screening;
    } else if ((stageFilter as any) === "vetting") {
      stageFilter = VettingStage.screening;
    } else if ((stageFilter as any) === "placed") {
      stageFilter = VettingStage.vetted;
    }

    const where: Prisma.TalentsWhereInput = {
      deletedAt: null,
      ...(stageFilter && { vettingStage: stageFilter }),
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

    const [skills, languages, experiences, educations, certifications, portfolio, references, documents, vettingSteps] = await Promise.all([
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
        throw new BadRequestException(`Candidate re-application waiting period active until ${existing.canReapplyAfter.toISOString().split("T")[0]}`);
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

    let stage = dto.stage;
    if ((stage as any) === "screened" || (stage as any) === "vetting") {
      stage = VettingStage.screening;
    } else if ((stage as any) === "placed") {
      stage = VettingStage.vetted;
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.talents.update({
        where: { id },
        data: {
          vettingStage: stage,
          ...((dto.stage as any) === "placed" && { status: TalentStatus.placed }),
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

      const stepType = stepTypeMap[stage];
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
          companyLabel: e.hideCompanyName ? e.publicCompanyLabel || "Confidential Company" : e.companyName,
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

  // ==========================================
  // TALENT PORTAL DASHBOARD (CONFIDENTIAL & ROLE-SAFE)
  // ==========================================

  async getTalentDashboard(user: AuthenticatedUser) {
    let talent = null;

    if (user.talentId) {
      talent = await this.prisma.talents.findUnique({
        where: { id: user.talentId },
      });
    }

    if (!talent && user.id) {
      talent = await this.prisma.talents.findFirst({
        where: { userId: user.id },
      });
    }

    // For staff preview or newly registered accounts without a linked talent row
    if (!talent) {
      if (user.role === UserRole.talent) {
        const names = (user.email.split("@")[0] || "Candidate").split(".");
        talent = await this.prisma.talents.create({
          data: {
            userId: user.id,
            email: user.email,
            firstName: names[0] ? names[0].charAt(0).toUpperCase() + names[0].slice(1) : "Candidate",
            lastName: names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : "Talent",
            status: TalentStatus.in_vetting,
            vettingStage: VettingStage.applied,
            countryCode: "DZ",
            profileCompleteness: 35,
          },
        });
      } else {
        talent = await this.prisma.talents.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        });
      }
    }

    if (!talent) {
      throw new NotFoundException("Talent profile not found");
    }

    const talentId = talent.id;

    // 1. Vetting Steps & Stage Progress
    const vettingSteps = await this.prisma.vettingSteps.findMany({
      where: { talentId },
      orderBy: { createdAt: "asc" },
    });

    const pipelineStages = [
      { key: "applied", label: "Applied", completed: true },
      {
        key: "screening",
        label: "CV & HR Screening",
        completed: (
          [
            VettingStage.hr_interview,
            VettingStage.technical_test,
            VettingStage.tech_interview,
            VettingStage.references,
            VettingStage.vetted,
          ] as VettingStage[]
        ).includes(talent.vettingStage),
        current: talent.vettingStage === VettingStage.screening,
      },
      {
        key: "technical_test",
        label: "Technical Assessment",
        completed: ([VettingStage.tech_interview, VettingStage.references, VettingStage.vetted] as VettingStage[]).includes(talent.vettingStage),
        current: talent.vettingStage === VettingStage.technical_test,
      },
      {
        key: "tech_interview",
        label: "Technical Interview",
        completed: ([VettingStage.references, VettingStage.vetted] as VettingStage[]).includes(talent.vettingStage),
        current: talent.vettingStage === VettingStage.tech_interview,
      },
      {
        key: "vetted",
        label: "Vetted & Ready",
        completed: talent.vettingStage === VettingStage.vetted,
        current: talent.vettingStage === VettingStage.vetted,
      },
    ];

    // 2. Active Placement (Confidential: Strictly hides client price & margin - FR-SEC-02)
    const activePlacementRecord = await this.prisma.placements.findFirst({
      where: {
        talentId,
        status: { in: ["in_trial", "active", "notice"] },
      },
      orderBy: { startDate: "desc" },
    });

    let activePlacement: any = null;
    if (activePlacementRecord) {
      const [company, jobRole] = await Promise.all([
        this.prisma.companies.findUnique({
          where: { id: activePlacementRecord.companyId },
          select: { name: true, industry: true },
        }),
        activePlacementRecord.jobRoleId
          ? this.prisma.jobRoles.findUnique({
              where: { id: activePlacementRecord.jobRoleId },
              select: { nameEn: true, nameFr: true },
            })
          : null,
      ]);

      const now = new Date();
      let trialDay = 0;
      if (activePlacementRecord.status === "in_trial" && activePlacementRecord.startDate) {
        const diffMs = now.getTime() - new Date(activePlacementRecord.startDate).getTime();
        trialDay = Math.max(1, Math.min(10, Math.ceil(diffMs / (1000 * 60 * 60 * 24))));
      }

      activePlacement = {
        id: activePlacementRecord.id,
        reference: activePlacementRecord.reference,
        clientName: company?.name ?? "Client Partner",
        industry: company?.industry ?? "Technology",
        roleName: jobRole?.nameEn ?? "Software Engineer",
        engagementModel: activePlacementRecord.engagementModel,
        status: activePlacementRecord.status,
        startDate: activePlacementRecord.startDate ? activePlacementRecord.startDate.toISOString().split("T")[0] : null,
        trialEndDate: activePlacementRecord.trialEndDate ? activePlacementRecord.trialEndDate.toISOString().split("T")[0] : null,
        trialDay,
        timeSharePct: activePlacementRecord.timeSharePct,
        monthlyPay: activePlacementRecord.talentPay ? activePlacementRecord.talentPay.toString() : "0.00",
        dailyPay: activePlacementRecord.talentDailyPay ? activePlacementRecord.talentDailyPay.toString() : null,
        currency: activePlacementRecord.currency,
        paidLeaveDaysPerMonth: activePlacementRecord.paidLeaveDaysPerMonth ?? 1.5,
      };
    }

    // 3. Current Month Timesheet
    const currentDate = new Date();
    const currentMonthStart = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1));
    let timesheetSummary = {
      month: currentMonthStart.toISOString().split("T")[0],
      monthName: currentDate.toLocaleString("default", { month: "long", year: "numeric" }),
      status: "none",
      daysLogged: 0,
      totalWorkingDays: 22,
      submissionDeadline: new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1)).toISOString().split("T")[0],
    };

    if (activePlacementRecord) {
      const timesheet = await this.prisma.timesheets.findFirst({
        where: {
          placementId: activePlacementRecord.id,
          month: currentMonthStart,
        },
      });

      if (timesheet) {
        const entriesCount = await this.prisma.timesheetEntries.count({
          where: { timesheetId: timesheet.id },
        });
        timesheetSummary = {
          month: currentMonthStart.toISOString().split("T")[0],
          monthName: currentDate.toLocaleString("default", { month: "long", year: "numeric" }),
          status: timesheet.status,
          daysLogged: entriesCount,
          totalWorkingDays: 22,
          submissionDeadline: new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1)).toISOString().split("T")[0],
        };
      }
    }

    // 4. Payouts Summary
    const [pendingPayout, latestPaidPayout] = await Promise.all([
      this.prisma.payouts.findFirst({
        where: { talentId, status: { in: ["pending", "approved"] } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.payouts.findFirst({
        where: { talentId, status: "paid" },
        orderBy: { paidAt: "desc" },
      }),
    ]);

    const nextPayoutDate = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + (currentDate.getUTCDate() > 5 ? 1 : 0), 5));

    const payoutSummary = {
      pendingAmount: pendingPayout?.netAmount ? pendingPayout.netAmount.toString() : (activePlacement?.monthlyPay ?? "0.00"),
      pendingStatus: pendingPayout?.status ?? "estimated",
      currency: pendingPayout?.currency ?? talent.payCurrency ?? "EUR",
      estimatedPayoutDate: nextPayoutDate.toISOString().split("T")[0],
      lastPaidAmount: latestPaidPayout?.netAmount ? latestPaidPayout.netAmount.toString() : null,
      lastPaidDate: latestPaidPayout?.paidAt ? latestPaidPayout.paidAt.toISOString().split("T")[0] : null,
    };

    // 5. Upcoming Interviews
    const interviews = await this.prisma.interviews.findMany({
      where: {
        talentId,
        startsAt: { gte: new Date() },
        status: { in: ["proposed", "scheduled"] },
      },
      orderBy: { startsAt: "asc" },
      take: 3,
    });

    const upcomingInterviews = await Promise.all(
      interviews.map(async (inv) => {
        let companyName = "Partner Company";
        if (inv.companyId) {
          const comp = await this.prisma.companies.findUnique({
            where: { id: inv.companyId },
            select: { name: true },
          });
          if (comp?.name) companyName = comp.name;
        }
        const durationMinutes = inv.startsAt && inv.endsAt ? Math.round((inv.endsAt.getTime() - inv.startsAt.getTime()) / (1000 * 60)) : 45;
        return {
          id: inv.id,
          companyName,
          title: `Round ${inv.round} - Client Interview`,
          status: inv.status,
          startsAt: inv.startsAt ? inv.startsAt.toISOString() : null,
          durationMinutes,
          meetingUrl: inv.meetingLink,
        };
      }),
    );

    return {
      talent: {
        id: talent.id,
        firstName: talent.firstName,
        lastName: talent.lastName,
        email: talent.email,
        headline: talent.headline,
        seniority: talent.seniority,
        vettingStage: talent.vettingStage,
        vettingScore: talent.vettingScore ? talent.vettingScore.toString() : null,
        status: talent.status,
        availabilityDate: talent.availabilityDate ? talent.availabilityDate.toISOString().split("T")[0] : null,
        timeSharePct: talent.timeSharePct,
        profileCompleteness: talent.profileCompleteness || 60,
        agreedPay: talent.agreedPay ? talent.agreedPay.toString() : null,
        payCurrency: talent.payCurrency || "EUR",
      },
      pipelineStages,
      vettingSteps,
      activePlacement,
      timesheetSummary,
      payoutSummary,
      upcomingInterviews,
    };
  }

  async resolveTalentId(user: AuthenticatedUser): Promise<string> {
    let talent = user.talentId
      ? await this.prisma.talents.findUnique({ where: { id: user.talentId } })
      : null;
    if (!talent && user.id) {
      talent = await this.prisma.talents.findFirst({ where: { userId: user.id } });
    }
    if (!talent && user.role === UserRole.talent) {
      const names = (user.email.split("@")[0] || "Candidate").split(".");
      talent = await this.prisma.talents.create({
        data: {
          userId: user.id,
          email: user.email,
          firstName: names[0] ? names[0].charAt(0).toUpperCase() + names[0].slice(1) : "Candidate",
          lastName: names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : "Talent",
          status: TalentStatus.in_vetting,
          vettingStage: VettingStage.applied,
          countryCode: "DZ",
          profileCompleteness: 35,
        },
      });
    }
    if (!talent) {
      const first = await this.prisma.talents.findFirst({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
      if (first) talent = first;
    }
    if (!talent) throw new NotFoundException("Talent profile not found");
    return talent.id;
  }

  async getTalentInterviews(user: AuthenticatedUser) {
    const talentId = await this.resolveTalentId(user);
    const interviews = await this.prisma.interviews.findMany({
      where: { talentId },
      orderBy: { startsAt: "desc" },
    });

    return Promise.all(
      interviews.map(async (inv) => {
        let companyName = "Partner Company";
        let companyIndustry = "Technology";
        if (inv.companyId) {
          const comp = await this.prisma.companies.findUnique({
            where: { id: inv.companyId },
            select: { name: true, industry: true },
          });
          if (comp?.name) companyName = comp.name;
          if (comp?.industry) companyIndustry = comp.industry;
        }

        let roleTitle = "Dedicated Software Engineer";
        if (inv.requestId) {
          const req = await this.prisma.talentRequests.findUnique({
            where: { id: inv.requestId },
            select: { roleTitle: true },
          });
          if (req?.roleTitle) roleTitle = req.roleTitle;
        }

        const durationMinutes =
          inv.startsAt && inv.endsAt
            ? Math.round((inv.endsAt.getTime() - inv.startsAt.getTime()) / (1000 * 60))
            : 45;

        return {
          id: inv.id,
          companyName,
          companyIndustry,
          roleTitle,
          round: inv.round,
          title: `Round ${inv.round} - Client Technical Interview`,
          status: inv.status,
          startsAt: inv.startsAt ? inv.startsAt.toISOString() : null,
          endsAt: inv.endsAt ? inv.endsAt.toISOString() : null,
          timezone: inv.timezone || "Europe/Paris",
          durationMinutes,
          meetingLink: inv.meetingLink,
          meetingProvider: inv.meetingProvider || "Google Meet",
          prepNotes: inv.prepNotes,
          createdAt: inv.createdAt.toISOString(),
        };
      }),
    );
  }

  async submitTalentApplicationFromDashboard(
    currentUser: AuthenticatedUser,
    dto: SubmitTalentApplicationDto,
    cvFile?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    let talent = null;
    if (currentUser.talentId) {
      talent = await this.prisma.talents.findUnique({
        where: { id: currentUser.talentId },
      });
    }
    if (!talent && currentUser.id) {
      talent = await this.prisma.talents.findFirst({
        where: { userId: currentUser.id },
      });
    }

    if (!talent) {
      const user = currentUser.id
        ? await this.prisma.users.findUnique({ where: { id: currentUser.id } })
        : null;

      let firstName = user?.firstName || "";
      let lastName = user?.lastName || "";
      if (!firstName && !lastName) {
        const emailPrefix = currentUser.email.split("@")[0] || "Candidate";
        const parts = emailPrefix.split(".");
        firstName = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : "Candidate";
        lastName = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : "Talent";
      }

      talent = await this.prisma.talents.create({
        data: {
          userId: currentUser.id,
          email: currentUser.email,
          firstName,
          lastName,
          status: TalentStatus.in_vetting,
          vettingStage: VettingStage.applied,
          countryCode: "DZ",
        },
      });
    }

    let attachedFileId: string | undefined = undefined;
    if (cvFile && this.filesService) {
      const fileRecord = await this.filesService.uploadFile(cvFile, FileCategory.CV, currentUser);
      attachedFileId = fileRecord.id;
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      const updated = await tx.talents.update({
        where: { id: talent.id },
        data: {
          ...(dto.headline && { headline: dto.headline }),
          ...(dto.seniority && { seniority: dto.seniority }),
          ...(dto.yearsExperience && { yearsExperience: toDecimal(dto.yearsExperience) }),
          ...(dto.expectedNetPay && { expectedPay: toDecimal(dto.expectedNetPay) }),
          ...(dto.phone && { phone: dto.phone }),
          ...(dto.city && { city: dto.city }),
          ...(dto.linkedinUrl && { linkedinUrl: dto.linkedinUrl }),
          ...(dto.githubUrl && { githubUrl: dto.githubUrl }),
          vettingStage: VettingStage.applied,
          status: TalentStatus.in_vetting,
          updatedAt: new Date(),
        },
      });

      // Attach CV in talent_documents
      if (attachedFileId) {
        await tx.talentDocuments.create({
          data: {
            talentId: talent.id,
            fileId: attachedFileId,
            type: DocumentType.cv,
            label: "Candidate Resume",
            isCurrent: true,
          },
        });
      }

      // Link skills if provided
      const submittedSkills =
        typeof dto.skills === "string"
          ? dto.skills.split(",").map((skill) => skill.trim()).filter(Boolean)
          : Array.isArray(dto.skills)
            ? dto.skills
            : [];
      if (submittedSkills.length > 0) {
        const skillSlugs = submittedSkills.map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        const matchedSkills = await tx.skills.findMany({
          where: {
            OR: [
              { name: { in: submittedSkills, mode: "insensitive" } },
              { slug: { in: skillSlugs } },
            ],
          },
        });

        for (const skill of matchedSkills) {
          await tx.talentSkills.upsert({
            where: {
              talentId_skillId: {
                talentId: talent.id,
                skillId: skill.id,
              },
            },
            create: {
              talentId: talent.id,
              skillId: skill.id,
              level: SkillLevel.intermediate,
            },
            update: {},
          });
        }
      }

      // Ensure cv_screening vetting step is recorded
      const existingStep = await tx.vettingSteps.findFirst({
        where: { talentId: talent.id, type: VettingStepType.cv_screening },
      });
      if (!existingStep) {
        await tx.vettingSteps.create({
          data: {
            talentId: talent.id,
            type: VettingStepType.cv_screening,
            status: VettingStepStatus.in_progress,
            createdBy: currentUser.id,
          },
        });
      }

      // Return sanitized response object (leaks no internal Prisma fields)
      return {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        phone: updated.phone,
        city: updated.city,
        countryCode: updated.countryCode,
        headline: updated.headline,
        seniority: updated.seniority,
        yearsExperience: updated.yearsExperience?.toString() ?? null,
        expectedPay: updated.expectedPay?.toString() ?? null,
        payCurrency: updated.payCurrency,
        vettingStage: updated.vettingStage,
        status: updated.status,
        cvFileId: attachedFileId ?? null,
        linkedinUrl: updated.linkedinUrl,
        githubUrl: updated.githubUrl,
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }
}
