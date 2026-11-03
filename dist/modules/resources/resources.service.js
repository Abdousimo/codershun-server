var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/database/prisma.service";
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
};
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
let ResourcesService = class ResourcesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    delegate(resource) {
        if (!(resource in RESOURCE_ACCESSORS)) {
            throw new NotFoundException(`Unknown resource: ${resource}`);
        }
        const accessor = RESOURCE_ACCESSORS[resource];
        const delegate = this.prisma[accessor];
        if (!delegate || typeof delegate !== "object") {
            throw new NotFoundException(`Resource is not available: ${resource}`);
        }
        return delegate;
    }
    idWhere(id) {
        if (!id.trim()) {
            throw new BadRequestException("id is required");
        }
        return { id };
    }
    list(resource, query) {
        const delegate = this.delegate(resource);
        const skip = Math.max(Number(query.skip ?? 0) || 0, 0);
        const take = Math.min(Math.max(Number(query.take ?? 50) || 50, 1), 100);
        let where;
        if (query.where) {
            try {
                const parsed = JSON.parse(Array.isArray(query.where) ? query.where[0] : query.where);
                if (!isRecord(parsed))
                    throw new Error("where must be an object");
                where = parsed;
            }
            catch {
                throw new BadRequestException("where must be valid JSON object");
            }
        }
        const orderBy = query.orderBy
            ? { [Array.isArray(query.orderBy) ? query.orderBy[0] : query.orderBy]: "asc" }
            : undefined;
        return delegate.findMany({ where, skip, take, orderBy });
    }
    count(resource) {
        return this.delegate(resource).count();
    }
    findOne(resource, id) {
        return this.delegate(resource)
            .findUnique({ where: this.idWhere(id) })
            .then((record) => {
            if (!record)
                throw new NotFoundException(`${resource} record not found`);
            return record;
        });
    }
    create(resource, data) {
        if (!isRecord(data))
            throw new BadRequestException("Request body must be an object");
        return this.delegate(resource).create({ data });
    }
    async update(resource, id, data) {
        if (!isRecord(data))
            throw new BadRequestException("Request body must be an object");
        await this.findOne(resource, id);
        return this.delegate(resource).update({ where: this.idWhere(id), data });
    }
    async remove(resource, id) {
        await this.findOne(resource, id);
        await this.delegate(resource).delete({ where: this.idWhere(id) });
        return { deleted: true };
    }
};
ResourcesService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], ResourcesService);
export { ResourcesService };
