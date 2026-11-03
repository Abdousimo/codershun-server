import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  CefrLevel,
  SeniorityLevel,
  SkillLevel,
  TalentStatus,
  VettingStage,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { PricingService } from "../settings/pricing.service";
import { MatchedCandidateDto, MatchBreakdownDto } from "./dto/match-candidates.dto";

interface MatchingWeights {
  skills: number;
  seniority: number;
  availability: number;
  language: number;
  vetting: number;
}

const DEFAULT_WEIGHTS: MatchingWeights = {
  skills: 50,
  seniority: 20,
  availability: 15,
  language: 10,
  vetting: 5,
};

const SENIORITY_ORDER: Record<SeniorityLevel, number> = {
  [SeniorityLevel.junior]: 1,
  [SeniorityLevel.mid]: 2,
  [SeniorityLevel.senior]: 3,
  [SeniorityLevel.lead]: 4,
};

const SKILL_LEVEL_ORDER: Record<SkillLevel, number> = {
  [SkillLevel.beginner]: 1,
  [SkillLevel.intermediate]: 2,
  [SkillLevel.advanced]: 3,
  [SkillLevel.expert]: 4,
};

const CEFR_ORDER: Record<CefrLevel, number> = {
  [CefrLevel.A1]: 1,
  [CefrLevel.A2]: 2,
  [CefrLevel.B1]: 3,
  [CefrLevel.B2]: 4,
  [CefrLevel.C1]: 5,
  [CefrLevel.C2]: 6,
  [CefrLevel.native]: 7,
};

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Loads match score weights from settings (key: matching.weights).
   */
  async getWeights(): Promise<MatchingWeights> {
    try {
      const setting = await this.settingsService.getSettingByKey("matching.weights");
      const val = setting.value as unknown as MatchingWeights;
      if (val && typeof val.skills === "number") {
        return val;
      }
    } catch {
      // Fallback to default
    }
    return DEFAULT_WEIGHTS;
  }

  /**
   * Find matching candidate pool for a talent request.
   * Ranks candidates based on weighted multi-criteria score (0 to 100).
   */
  async findMatchesForRequest(requestId: string): Promise<MatchedCandidateDto[]> {
    const request = await this.prisma.talentRequests.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Talent request ${requestId} not found`);
    }

    const [reqSkills, reqLanguages] = await Promise.all([
      this.prisma.talentRequestSkills.findMany({ where: { requestId } }),
      this.prisma.talentRequestLanguages.findMany({ where: { requestId } }),
    ]);

    const weights = await this.getWeights();

    // 1. Fetch all candidate talents with status Vetted, Available/Proposed, not blacklisted
    const candidates = await this.prisma.talents.findMany({
      where: {
        vettingStage: VettingStage.vetted,
        status: { in: [TalentStatus.available, TalentStatus.proposed] },
        isBlacklisted: false,
        deletedAt: null,
      },
    });

    const candidateIds = candidates.map((c) => c.id);
    const [allCandSkills, allCandLanguages] = await Promise.all([
      candidateIds.length > 0
        ? this.prisma.talentSkills.findMany({ where: { talentId: { in: candidateIds } } })
        : [],
      candidateIds.length > 0
        ? this.prisma.talentLanguages.findMany({ where: { talentId: { in: candidateIds } } })
        : [],
    ]);

    // Group skills and languages by talentId
    const candSkillsMap = new Map<string, { skillId: string; level: SkillLevel }[]>();
    for (const s of allCandSkills) {
      const arr = candSkillsMap.get(s.talentId) || [];
      arr.push({ skillId: s.skillId, level: s.level });
      candSkillsMap.set(s.talentId, arr);
    }

    const candLanguagesMap = new Map<string, { languageCode: string; level: CefrLevel }[]>();
    for (const l of allCandLanguages) {
      const arr = candLanguagesMap.get(l.talentId) || [];
      arr.push({ languageCode: l.languageCode, level: l.level });
      candLanguagesMap.set(l.talentId, arr);
    }

    // 2. Fetch all existing shortlist items for this request to flag if already shortlisted
    const shortlistsForReq = await this.prisma.shortlists.findMany({
      where: { requestId },
      select: { id: true },
    });
    const shortlistIds = shortlistsForReq.map((s) => s.id);
    const existingShortlistItems = shortlistIds.length > 0
      ? await this.prisma.shortlistItems.findMany({
          where: { shortlistId: { in: shortlistIds } },
          select: { talentId: true },
        })
      : [];
    const alreadyShortlistedSet = new Set(existingShortlistItems.map((s) => s.talentId));

    // 3. Preload all taxonomy skills referenced by request
    const allReqSkillIds = reqSkills.map((s) => s.skillId);
    const taxonomySkills = allReqSkillIds.length > 0
      ? await this.prisma.skills.findMany({
          where: { id: { in: allReqSkillIds } },
          select: { id: true, name: true },
        })
      : [];
    const skillNameMap = new Map(taxonomySkills.map((s) => [s.id, s.name]));

    // 4. Score each candidate
    const scoredCandidates: MatchedCandidateDto[] = [];

    const requestContext = {
      seniority: request.seniority,
      desiredStartDate: request.desiredStartDate,
      timeSharePct: request.timeSharePct,
      skills: reqSkills,
      languages: reqLanguages,
    };

    for (const candidate of candidates) {
      const candidateSkills = candSkillsMap.get(candidate.id) || [];
      const candidateLanguages = candLanguagesMap.get(candidate.id) || [];

      const breakdown = this.calculateMatchBreakdown(
        requestContext,
        {
          seniority: candidate.seniority,
          status: candidate.status,
          availabilityDate: candidate.availabilityDate,
          timeSharePct: candidate.timeSharePct,
          vettingScore: candidate.vettingScore,
          skills: candidateSkills,
          languages: candidateLanguages,
        },
        weights,
      );

      const totalScore = Math.min(
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

      // Determine matched vs missing skills
      const candSkillIds = new Set(candidateSkills.map((s) => s.skillId));
      const matchedSkillIds = reqSkills.filter((s) => candSkillIds.has(s.skillId)).map((s) => s.skillId);
      const missingSkillIds = reqSkills.filter((s) => !candSkillIds.has(s.skillId)).map((s) => s.skillId);

      // Calculate suggested monthly client price for this candidate
      let suggestedMonthlyPrice: string | null = null;
      try {
        const quote = await this.pricingService.calculatePricing({
          seniority: candidate.seniority ?? request.seniority ?? SeniorityLevel.mid,
          talentNetPay: candidate.agreedPay ? candidate.agreedPay.toString() : undefined,
          isPartTime: request.timeSharePct === 50,
        });
        suggestedMonthlyPrice = quote.netClientPrice;
      } catch {
        // Fallback silently if rate card missing
      }

      scoredCandidates.push({
        talentId: candidate.id,
        publicSlug: candidate.publicSlug || `talent-${candidate.id.slice(0, 8)}`,
        roleTitle: candidate.headline || request.roleTitle,
        seniority: candidate.seniority,
        experienceYears: candidate.yearsExperience ? Number(candidate.yearsExperience) : null,
        matchScore: totalScore,
        matchBreakdown: breakdown,
        matchedSkills: matchedSkillIds.map((id) => skillNameMap.get(id) || "Skill"),
        missingSkills: missingSkillIds.map((id) => skillNameMap.get(id) || "Skill"),
        availabilityStatus: candidate.status,
        availabilityDate: candidate.availabilityDate ? candidate.availabilityDate.toISOString().split("T")[0] : null,
        suggestedMonthlyPrice,
        vettingScore: candidate.vettingScore ? Number(candidate.vettingScore) : null,
        isAlreadyShortlisted: alreadyShortlistedSet.has(candidate.id),
      });
    }

    // Sort by match score descending
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

    return scoredCandidates;
  }

  /**
   * Internal calculator for multi-criteria score breakdown.
   */
  calculateMatchBreakdown(
    request: {
      seniority?: SeniorityLevel | null;
      desiredStartDate?: Date | null;
      timeSharePct: number;
      skills: { skillId: string; isRequired: boolean; minLevel?: SkillLevel | null }[];
      languages: { languageCode: string; minLevel: CefrLevel }[];
    },
    candidate: {
      seniority?: SeniorityLevel | null;
      status: TalentStatus;
      availabilityDate?: Date | null;
      timeSharePct: number;
      vettingScore?: any;
      skills: { skillId: string; level: SkillLevel }[];
      languages: { languageCode: string; level: CefrLevel }[];
    },
    weights: MatchingWeights,
  ): MatchBreakdownDto {
    // 1. Skills score (default 50 pts)
    let skillsFraction = 1.0;
    if (request.skills.length > 0) {
      const candidateSkillsMap = new Map(candidate.skills.map((s) => [s.skillId, s.level]));
      const required = request.skills.filter((s) => s.isRequired);
      const optional = request.skills.filter((s) => !s.isRequired);

      let reqScore = 1.0;
      if (required.length > 0) {
        let earned = 0;
        for (const req of required) {
          const candLevel = candidateSkillsMap.get(req.skillId);
          if (candLevel) {
            const minOrd = req.minLevel ? SKILL_LEVEL_ORDER[req.minLevel] : 1;
            const candOrd = SKILL_LEVEL_ORDER[candLevel];
            earned += candOrd >= minOrd ? 1.0 : 0.7;
          }
        }
        reqScore = earned / required.length;
      }

      let optScore = 1.0;
      if (optional.length > 0) {
        let earned = 0;
        for (const opt of optional) {
          const candLevel = candidateSkillsMap.get(opt.skillId);
          if (candLevel) earned += 1.0;
        }
        optScore = earned / optional.length;
      }

      // 75% weight on required, 25% on optional if both exist
      skillsFraction = optional.length > 0 ? reqScore * 0.75 + optScore * 0.25 : reqScore;
    }

    // 2. Seniority score (default 20 pts)
    let seniorityFraction = 1.0;
    if (request.seniority && candidate.seniority) {
      const reqOrd = SENIORITY_ORDER[request.seniority];
      const candOrd = SENIORITY_ORDER[candidate.seniority];
      if (candOrd === reqOrd) {
        seniorityFraction = 1.0;
      } else if (candOrd > reqOrd) {
        seniorityFraction = 0.85; // slightly over-qualified
      } else if (candOrd === reqOrd - 1) {
        seniorityFraction = 0.5; // one level under
      } else {
        seniorityFraction = 0.2;
      }
    }

    // 3. Availability score (default 15 pts)
    let availabilityFraction = 1.0;
    if (candidate.status === TalentStatus.proposed) {
      availabilityFraction *= 0.8;
    }
    if (request.desiredStartDate && candidate.availabilityDate) {
      const diffDays = Math.ceil(
        (candidate.availabilityDate.getTime() - request.desiredStartDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (diffDays > 30) {
        availabilityFraction *= 0.3;
      } else if (diffDays > 14) {
        availabilityFraction *= 0.6;
      } else if (diffDays > 0) {
        availabilityFraction *= 0.85;
      }
    }
    // Capacity check
    if (request.timeSharePct === 100 && candidate.timeSharePct < 100) {
      availabilityFraction *= 0.5;
    }

    // 4. Language score (default 10 pts)
    let languageFraction = 1.0;
    if (request.languages.length > 0) {
      const candLangMap = new Map(candidate.languages.map((l) => [l.languageCode.toLowerCase(), l.level]));
      let earned = 0;
      for (const reqLang of request.languages) {
        const candLevel = candLangMap.get(reqLang.languageCode.toLowerCase());
        if (candLevel) {
          const reqOrd = CEFR_ORDER[reqLang.minLevel];
          const candOrd = CEFR_ORDER[candLevel];
          if (candOrd >= reqOrd) {
            earned += 1.0;
          } else if (candOrd === reqOrd - 1) {
            earned += 0.6;
          } else {
            earned += 0.2;
          }
        }
      }
      languageFraction = earned / request.languages.length;
    }

    // 5. Vetting scorecard score (default 5 pts)
    let vettingFraction = 0.7; // default average if no scorecard score
    if (candidate.vettingScore) {
      const score = Number(candidate.vettingScore);
      vettingFraction = Math.min(1.0, Math.max(0, score / 100));
    }

    return {
      skills: Math.round(skillsFraction * weights.skills * 10) / 10,
      seniority: Math.round(seniorityFraction * weights.seniority * 10) / 10,
      availability: Math.round(availabilityFraction * weights.availability * 10) / 10,
      language: Math.round(languageFraction * weights.language * 10) / 10,
      vetting: Math.round(vettingFraction * weights.vetting * 10) / 10,
    };
  }
}
