import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/database/prisma.service";

type QueryArgs = {
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: Record<string, "asc" | "desc">;
};

type CrudDelegate = {
  findMany(args?: QueryArgs): Promise<unknown[]>;
  findUnique(args: { where: Record<string, unknown> }): Promise<unknown | null>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: Record<string, unknown> }): Promise<unknown>;
};

export const RESOURCE_ACCESSORS = {
  currencies: "currencies",
  "fx-rates": "fxRates",
  "legal-entities": "legalEntities",
  settings: "settings",
  "rate-card-versions": "rateCardVersions",
  "rate-card-entries": "rateCardEntries",
  "discount-rules": "discountRules",
  "buyout-tiers": "buyoutTiers",
  "referral-reward-rules": "referralRewardRules",
  "work-calendars": "workCalendars",
  "public-holidays": "publicHolidays",
  "salary-benchmarks": "salaryBenchmarks",
  users: "users",
  "oauth-accounts": "oauthAccounts",
  "auth-tokens": "authTokens",
  "user-sessions": "userSessions",
  "staff-profiles": "staffProfiles",
  consents: "consents",
  "gdpr-requests": "gdprRequests",
  files: "files",
  "job-categories": "jobCategories",
  "job-roles": "jobRoles",
  skills: "skills",
  languages: "languages",
  tags: "tags",
  referrers: "referrers",
  companies: "companies",
  contacts: "contacts",
  "company-users": "companyUsers",
  leads: "leads",
  "form-submissions": "formSubmissions",
  talents: "talents",
  "talent-skills": "talentSkills",
  "talent-languages": "talentLanguages",
  "talent-experiences": "talentExperiences",
  "talent-educations": "talentEducations",
  "talent-certifications": "talentCertifications",
  "talent-portfolio-items": "talentPortfolioItems",
  "talent-references": "talentReferences",
  "talent-tags": "talentTags",
  "talent-documents": "talentDocuments",
  "vetting-steps": "vettingSteps",
  scorecards: "scorecards",
  "scorecard-scores": "scorecardScores",
  "talent-requests": "talentRequests",
  "talent-request-skills": "talentRequestSkills",
  "talent-request-languages": "talentRequestLanguages",
  shortlists: "shortlists",
  "shortlist-items": "shortlistItems",
  interviews: "interviews",
  "interview-slots": "interviewSlots",
  "interview-participants": "interviewParticipants",
  "interview-feedback": "interviewFeedback",
  placements: "placements",
  "status-history": "statusHistory",
  "placement-status-transitions": "placementStatusTransitions",
  "placement-onboarding-items": "placementOnboardingItems",
  "check-ins": "checkIns",
  "risk-flags": "riskFlags",
  absences: "absences",
  "trial-losses": "trialLosses",
  "buyout-quotes": "buyoutQuotes",
  "project-milestones": "projectMilestones",
  "contract-templates": "contractTemplates",
  "contract-template-versions": "contractTemplateVersions",
  contracts: "contracts",
  "contract-signatories": "contractSignatories",
  timesheets: "timesheets",
  "timesheet-entries": "timesheetEntries",
  "invoice-number-sequences": "invoiceNumberSequences",
  invoices: "invoices",
  "invoice-lines": "invoiceLines",
  payments: "payments",
  "invoice-reminders": "invoiceReminders",
  payouts: "payouts",
  "payout-lines": "payoutLines",
  "referral-clicks": "referralClicks",
  referrals: "referrals",
  "referral-rewards": "referralRewards",
  notes: "notes",
  tasks: "tasks",
  activities: "activities",
  "entity-attachments": "entityAttachments",
  "company-tags": "companyTags",
  "saved-views": "savedViews",
  "email-templates": "emailTemplates",
  notifications: "notifications",
  "notification-preferences": "notificationPreferences",
  "scheduled-jobs-log": "scheduledJobsLog",
  "audit-log": "auditLog",
} as const;

type ResourceName = keyof typeof RESOURCE_ACCESSORS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  private delegate(resource: string): CrudDelegate {
    if (!(resource in RESOURCE_ACCESSORS)) {
      throw new NotFoundException(`Unknown resource: ${resource}`);
    }
    const accessor = RESOURCE_ACCESSORS[resource as ResourceName];
    const delegate = (this.prisma as unknown as Record<string, unknown>)[accessor];
    if (!delegate || typeof delegate !== "object") {
      throw new NotFoundException(`Resource is not available: ${resource}`);
    }
    return delegate as CrudDelegate;
  }

  private idWhere(id: string) {
    if (!id.trim()) {
      throw new BadRequestException("id is required");
    }
    return { id };
  }

  list(resource: string, query: Record<string, string | string[] | undefined>) {
    const delegate = this.delegate(resource);
    const skip = Math.max(Number(query.skip ?? 0) || 0, 0);
    const take = Math.min(Math.max(Number(query.take ?? 50) || 50, 1), 100);
    let where: Record<string, unknown> | undefined;
    if (query.where) {
      try {
        const parsed = JSON.parse(Array.isArray(query.where) ? query.where[0] : query.where);
        if (!isRecord(parsed)) throw new Error("where must be an object");
        where = parsed;
      } catch {
        throw new BadRequestException("where must be valid JSON object");
      }
    }
    const orderBy = query.orderBy
      ? { [Array.isArray(query.orderBy) ? query.orderBy[0] : query.orderBy]: "asc" as const }
      : undefined;
    return delegate.findMany({ where, skip, take, orderBy });
  }

  count(resource: string) {
    return this.delegate(resource).count();
  }

  findOne(resource: string, id: string) {
    return this.delegate(resource)
      .findUnique({ where: this.idWhere(id) })
      .then((record) => {
        if (!record) throw new NotFoundException(`${resource} record not found`);
        return record;
      });
  }

  create(resource: string, data: unknown) {
    if (!isRecord(data)) throw new BadRequestException("Request body must be an object");
    return this.delegate(resource).create({ data });
  }

  async update(resource: string, id: string, data: unknown) {
    if (!isRecord(data)) throw new BadRequestException("Request body must be an object");
    await this.findOne(resource, id);
    return this.delegate(resource).update({ where: this.idWhere(id), data });
  }

  async remove(resource: string, id: string) {
    await this.findOne(resource, id);
    await this.delegate(resource).delete({ where: this.idWhere(id) });
    return { deleted: true };
  }
}
