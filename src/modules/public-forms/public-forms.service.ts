import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as crypto from "node:crypto";

import {
  CefrLevel,
  CompanyStatus,
  ConsentType,
  DocumentType,
  LeadSource,
  LeadStage,
  Prisma,
  ReferrerKind,
  SeniorityLevel,
  TalentStatus,
  UserRole,
  UserStatus,
  VettingStage,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { toDecimal } from "../../common/utils/money";
import { PricingService } from "../settings/pricing.service";
import { FilesService } from "../files/files.service";
import { FileCategory } from "../files/dto/upload-file.dto";
import { PublicHireRequestDto } from "./dto/hire-request.dto";
import { PublicTalentApplicationDto } from "./dto/talent-application.dto";
import { PublicContactFormDto } from "./dto/contact-form.dto";
import { PublicReferrerSignupDto } from "./dto/referrer-signup.dto";
import { HireRequestResponseDto, ReferrerSignupResponseDto, TalentApplicationResponseDto } from "./dto/public-form-response.dto";

@Injectable()
export class PublicFormsService {
  private readonly logger = new Logger(PublicFormsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: PricingService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Public client hire request (CDC §8.1).
   * Creates Company (lead) + Contact + Lead + Talent Request + Form Submission + Consent.
   */
  async submitHireRequest(dto: PublicHireRequestDto, clientIp?: string, userAgent?: string): Promise<HireRequestResponseDto> {
    const seniority = dto.seniority ?? SeniorityLevel.mid;

    // 1. Calculate indicative pricing range using PricingService
    const quote = await this.pricingService.calculatePricing({
      seniority,
      isPartTime: dto.isPartTime ?? false,
      numTalents: dto.talentsCount,
    });

    const priceMin = toDecimal(quote.netClientPrice);
    const priceMax = priceMin.times(new Prisma.Decimal("1.25")); // +25% upper bound for rare skills/bonuses

    // 2. Perform atomic database mutations
    const result = await this.prisma.$transaction(async (tx) => {
      // a. Find or create company
      let company = await tx.companies.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { name: { equals: dto.companyName, mode: Prisma.QueryMode.insensitive } },
            ...(dto.website ? [{ website: { equals: dto.website, mode: Prisma.QueryMode.insensitive } }] : []),
          ],
        },
      });

      if (!company) {
        company = await tx.companies.create({
          data: {
            name: dto.companyName,
            countryCode: dto.countryCode.toUpperCase(),
            website: dto.website,
            billingEmail: dto.workEmail,
            currency: dto.budgetCurrency ?? "EUR",
            status: CompanyStatus.lead,
            source: LeadSource.hire_form,
          },
        });
      }

      // b. Find or create contact
      const names = dto.name.trim().split(" ");
      const firstName = names[0] || "Unknown";
      const lastName = names.slice(1).join(" ") || undefined;

      let contact = await tx.contacts.findFirst({
        where: { email: { equals: dto.workEmail, mode: Prisma.QueryMode.insensitive } },
      });

      if (!contact) {
        contact = await tx.contacts.create({
          data: {
            companyId: company.id,
            firstName,
            lastName,
            email: dto.workEmail,
            phone: dto.phone,
            isDecisionMaker: true,
          },
        });
      }

      // c. Resolve referral code if provided
      let referrerId: string | null = null;
      if (dto.referralCode) {
        const referrer = await tx.referrers.findFirst({
          where: { code: { equals: dto.referralCode, mode: Prisma.QueryMode.insensitive }, isActive: true },
        });
        if (referrer) {
          referrerId = referrer.id;
        }
      }

      // d. Create Lead
      const lead = await tx.leads.create({
        data: {
          companyId: company.id,
          contactId: contact.id,
          stage: LeadStage.new_lead,
          source: LeadSource.hire_form,
          heardAboutUs: dto.heardAboutUs,
          utmSource: dto.utmSource,
          utmMedium: dto.utmMedium,
          utmCampaign: dto.utmCampaign,
          utmTerm: dto.utmTerm,
          utmContent: dto.utmContent,
          landingPage: dto.landingPage,
          referrerUrl: dto.referrerUrl,
          referralCode: dto.referralCode,
          referrerId,
          estimatedMonthlyValue: priceMin,
          notes: dto.notes,
        },
      });

      // e. Create Talent Request
      const talentRequest = await tx.talentRequests.create({
        data: {
          companyId: company.id,
          contactId: contact.id,
          leadId: lead.id,
          sourceTalentId: dto.sourceTalentId,
          engagementModel: dto.engagementModel,
          categoryId: dto.categoryId,
          jobRoleId: dto.jobRoleId,
          roleTitle: dto.roleTitle,
          seniority: dto.seniority,
          talentsCount: dto.talentsCount ?? 1,
          timezoneOverlapHours: dto.timezoneOverlapHours,
          startWindow: dto.startWindow,
          desiredStartDate: dto.desiredStartDate ? new Date(dto.desiredStartDate) : null,
          duration: dto.duration,
          timeSharePct: dto.isPartTime ? 50 : 100,
          budgetMin: dto.budgetMin ? toDecimal(dto.budgetMin) : null,
          budgetMax: dto.budgetMax ? toDecimal(dto.budgetMax) : null,
          budgetCurrency: dto.budgetCurrency ?? "EUR",
          indicativePriceMin: priceMin,
          indicativePriceMax: priceMax,
          description: dto.notes,
        },
      });

      // f. Link required skills if supplied
      if (dto.skillIds && dto.skillIds.length > 0) {
        await tx.talentRequestSkills.createMany({
          data: dto.skillIds.map((skillId) => ({
            requestId: talentRequest.id,
            skillId,
            isRequired: true,
          })),
          skipDuplicates: true,
        });
      }

      // g. Link required languages if supplied
      if (dto.languageCodes && dto.languageCodes.length > 0) {
        await tx.talentRequestLanguages.createMany({
          data: dto.languageCodes.map((code) => ({
            requestId: talentRequest.id,
            languageCode: code.toLowerCase(),
            minLevel: CefrLevel.B2,
          })),
          skipDuplicates: true,
        });
      }

      // h. Record in form_submissions table
      await tx.formSubmissions.create({
        data: {
          formType: "hire_request",
          locale: dto.locale ?? "en",
          payload: dto as unknown as Prisma.InputJsonValue,
          leadId: lead.id,
          ip: clientIp,
          userAgent,
          processedAt: new Date(),
        },
      });

      // i. Record consent
      if (dto.privacyPolicyAccepted) {
        await tx.consents.create({
          data: {
            email: dto.workEmail,
            consentType: ConsentType.privacy_policy,
            granted: true,
            ip: clientIp,
            userAgent,
          },
        });
      }

      return {
        leadId: lead.id,
        companyId: company.id,
        contactId: contact.id,
        talentRequestId: talentRequest.id,
      };
    });

    return {
      success: true,
      leadId: result.leadId,
      companyId: result.companyId,
      contactId: result.contactId,
      talentRequestId: result.talentRequestId,
      indicativePriceRange: {
        min: priceMin.toFixed(2),
        max: priceMax.toFixed(2),
        currency: dto.budgetCurrency ?? "EUR",
      },
      discoveryCallBookingUrl: "https://calendly.com/codershub/discovery",
    };
  }

  /**
   * Public talent application (CDC §8.5).
   * Validates duplicate, uploads CV to VPS, creates User + Talent + Skills + Languages + Consent.
   */
  async submitTalentApplication(
    dto: PublicTalentApplicationDto,
    cvFile?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    clientIp?: string,
    userAgent?: string,
  ): Promise<TalentApplicationResponseDto> {
    const email = dto.email.trim().toLowerCase();

    // 1. Check for duplicates / blacklist / reapply wait period (FR-TAL-03)
    const existingTalent = await this.prisma.talents.findFirst({
      where: { email: { equals: email, mode: Prisma.QueryMode.insensitive } },
    });

    if (existingTalent) {
      if (existingTalent.isBlacklisted) {
        throw new BadRequestException("Application cannot be processed.");
      }
      if (existingTalent.canReapplyAfter && new Date() < existingTalent.canReapplyAfter) {
        throw new BadRequestException(
          `You have recently applied. You may re-apply after ${existingTalent.canReapplyAfter.toISOString().split("T")[0]}.`,
        );
      }
    }

    // 2. Handle CV file upload if file provided directly in multipart
    let attachedFileId = dto.cvFileId;
    if (cvFile) {
      const fileRecord = await this.filesService.uploadFile(cvFile, FileCategory.CV);
      attachedFileId = fileRecord.id;
    }

    // 3. Atomically create User and Talent record
    const result = await this.prisma.$transaction(async (tx) => {
      // Find or create User
      let user = await tx.users.findUnique({
        where: { email },
      });

      if (!user) {
        user = await tx.users.create({
          data: {
            email,
            role: UserRole.talent,
            status: UserStatus.invited,
            twoFactorEnabled: false,
          },
        });
      }

      // Create Talent profile
      const talent = await tx.talents.create({
        data: {
          userId: user.id,
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
          linkedinUrl: dto.linkedinUrl,
          githubUrl: dto.githubUrl,
          portfolioUrl: dto.portfolioUrl,
          expectedPay: toDecimal(dto.expectedNetPay),
          payCurrency: dto.payCurrency ?? "EUR",
          availabilityDate: dto.availabilityDate ? new Date(dto.availabilityDate) : null,
          noticePeriodDays: dto.noticePeriodDays ?? 0,
          timeSharePct: dto.timeSharePct ?? 100,
          vettingStage: VettingStage.applied,
          status: TalentStatus.in_vetting,
          showcaseOptIn: dto.showcaseOptIn ?? false,
          showcaseConsentAt: dto.showcaseOptIn ? new Date() : null,
        },
      });

      // Attach CV in talent_documents if available
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

      // Attach skills
      if (dto.skillIds && dto.skillIds.length > 0) {
        await tx.talentSkills.createMany({
          data: dto.skillIds.map((skillId) => ({
            talentId: talent.id,
            skillId,
          })),
          skipDuplicates: true,
        });
      }

      // Attach languages
      if (dto.languages && dto.languages.length > 0) {
        await tx.talentLanguages.createMany({
          data: dto.languages.map((l) => ({
            talentId: talent.id,
            languageCode: l.code.toLowerCase(),
            level: l.level,
          })),
          skipDuplicates: true,
        });
      }

      // Log form submission
      await tx.formSubmissions.create({
        data: {
          formType: "talent_application",
          locale: dto.locale ?? "en",
          payload: dto as unknown as Prisma.InputJsonValue,
          ip: clientIp,
          userAgent,
          processedAt: new Date(),
        },
      });

      // Log consent
      if (dto.privacyPolicyAccepted) {
        await tx.consents.create({
          data: {
            userId: user.id,
            email,
            consentType: ConsentType.privacy_policy,
            granted: true,
            ip: clientIp,
            userAgent,
          },
        });
      }

      return {
        talentId: talent.id,
        userId: user.id,
      };
    });

    return {
      success: true,
      talentId: result.talentId,
      userId: result.userId,
      message: "Application submitted successfully. We will review your profile and contact you for screening.",
    };
  }

  /**
   * Public contact inquiry (CDC §8.11).
   */
  async submitContactForm(dto: PublicContactFormDto, clientIp?: string, userAgent?: string) {
    await this.prisma.formSubmissions.create({
      data: {
        formType: "contact",
        locale: dto.locale ?? "en",
        payload: dto as unknown as Prisma.InputJsonValue,
        ip: clientIp,
        userAgent,
        processedAt: new Date(),
      },
    });

    if (dto.privacyPolicyAccepted) {
      await this.prisma.consents.create({
        data: {
          email: dto.email,
          consentType: ConsentType.privacy_policy,
          granted: true,
          ip: clientIp,
          userAgent,
        },
      });
    }

    return {
      success: true,
      message: "Thank you for reaching out. A Coders Hub representative will contact you shortly.",
    };
  }

  /**
   * Public referral affiliate sign-up (CDC §5.6 / 6.5).
   */
  async submitReferrerSignup(dto: PublicReferrerSignupDto, clientIp?: string, userAgent?: string): Promise<ReferrerSignupResponseDto> {
    const email = dto.email.trim().toLowerCase();

    // Check if referrer already exists
    const existing = await this.prisma.referrers.findFirst({
      where: { email: { equals: email, mode: Prisma.QueryMode.insensitive } },
    });

    if (existing) {
      return {
        success: true,
        referrerCode: existing.code,
        referralLink: `https://codershub.dz/r/${existing.code}`,
        message: "You are already registered as a referrer. Here is your referral code.",
      };
    }

    // Generate unique alphanumeric referral code
    const uniqueHash = crypto.randomBytes(3).toString("hex").toUpperCase();
    const referrerCode = `REF-${uniqueHash}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.referrers.create({
        data: {
          name: dto.name,
          email,
          kind: dto.kind ?? ReferrerKind.partner,
          phone: dto.phone,
          code: referrerCode,
          paymentMethod: dto.paymentMethod,
          paymentDetails: (dto.paymentDetails ?? {}) as Prisma.InputJsonValue,
          termsAcceptedAt: dto.termsAccepted ? new Date() : null,
          isActive: true,
        },
      });

      await tx.formSubmissions.create({
        data: {
          formType: "referrer_signup",
          locale: dto.locale ?? "en",
          payload: dto as unknown as Prisma.InputJsonValue,
          ip: clientIp,
          userAgent,
          processedAt: new Date(),
        },
      });

      if (dto.termsAccepted) {
        await tx.consents.create({
          data: {
            email,
            consentType: ConsentType.referral_terms,
            granted: true,
            ip: clientIp,
            userAgent,
          },
        });
      }
    });

    return {
      success: true,
      referrerCode,
      referralLink: `https://codershub.dz/r/${referrerCode}`,
      message: "Referrer registered successfully. Share your link to earn referral rewards.",
    };
  }
}
