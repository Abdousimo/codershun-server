import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import {
  EngagementModel,
  ReferrerKind,
  SeniorityLevel,
  TalentStatus,
  UserRole,
  VettingStage,
} from "../../generated/prisma/client";
import { PublicFormsService } from "./public-forms.service";

describe("PublicFormsService", () => {
  let service: PublicFormsService;
  let mockPrisma: any;
  let mockPricingService: any;
  let mockFilesService: any;

  beforeEach(() => {
    mockPricingService = {
      calculatePricing: jest.fn<any>().mockResolvedValue({
        netClientPrice: "2000.00",
      }),
    };

    mockFilesService = {
      uploadFile: jest.fn<any>().mockResolvedValue({
        id: "cv-file-uuid-1",
        storageKey: "2026/11/resume.pdf",
      }),
    };

    mockPrisma = {
      companies: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "comp-1", ...args.data }),
        ),
      },
      contacts: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "contact-1", ...args.data }),
        ),
      },
      referrers: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "ref-1", ...args.data }),
        ),
      },
      leads: {
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "lead-1", ...args.data }),
        ),
      },
      talentRequests: {
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "request-1", ...args.data }),
        ),
      },
      talentRequestSkills: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      talentRequestLanguages: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      users: {
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "user-1", ...args.data }),
        ),
      },
      talents: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "talent-1", ...args.data }),
        ),
      },
      talentDocuments: {
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "doc-1", ...args.data }),
        ),
      },
      talentSkills: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      talentLanguages: {
        createMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
      },
      formSubmissions: {
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "sub-1", ...args.data }),
        ),
      },
      consents: {
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "consent-1", ...args.data }),
        ),
      },
      $transaction: jest.fn<any>((fn) => fn(mockPrisma)),
    };

    service = new PublicFormsService(
      mockPrisma,
      mockPricingService,
      mockFilesService,
    );
  });

  describe("Public Hire Requests (CDC §8.1)", () => {
    it("creates lead, company, contact, and talent request with indicative pricing", async () => {
      const result = await service.submitHireRequest(
        {
          engagementModel: EngagementModel.dedicated_developer,
          seniority: SeniorityLevel.mid,
          talentsCount: 1,
          name: "John Connor",
          workEmail: "john@cyberdyne.fr",
          companyName: "Cyberdyne Corp",
          countryCode: "FR",
          privacyPolicyAccepted: true,
        },
        "127.0.0.1",
        "Mozilla/5.0",
      );

      expect(mockPricingService.calculatePricing).toHaveBeenCalledWith({
        seniority: SeniorityLevel.mid,
        isPartTime: false,
        numTalents: 1,
      });

      expect(mockPrisma.companies.create).toHaveBeenCalled();
      expect(mockPrisma.contacts.create).toHaveBeenCalled();
      expect(mockPrisma.leads.create).toHaveBeenCalled();
      expect(mockPrisma.talentRequests.create).toHaveBeenCalled();
      expect(mockPrisma.formSubmissions.create).toHaveBeenCalled();
      expect(mockPrisma.consents.create).toHaveBeenCalled();

      expect(result.success).toBe(true);
      expect(result.leadId).toBe("lead-1");
      expect(result.indicativePriceRange.min).toBe("2000.00");
      expect(result.indicativePriceRange.max).toBe("2500.00");
    });
  });

  describe("Public Talent Applications (CDC §8.5, FR-TAL-03)", () => {
    it("rejects candidate application if candidate is blacklisted", async () => {
      mockPrisma.talents.findFirst.mockResolvedValue({
        id: "tal-blacklisted",
        email: "bad@example.com",
        isBlacklisted: true,
      });

      await expect(
        service.submitTalentApplication({
          firstName: "Bad",
          lastName: "User",
          email: "bad@example.com",
          expectedNetPay: "2000.00",
          privacyPolicyAccepted: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects candidate application if re-apply delay period is active", async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);

      mockPrisma.talents.findFirst.mockResolvedValue({
        id: "tal-rejected",
        email: "wait@example.com",
        canReapplyAfter: futureDate,
      });

      await expect(
        service.submitTalentApplication({
          firstName: "Wait",
          lastName: "User",
          email: "wait@example.com",
          expectedNetPay: "2000.00",
          privacyPolicyAccepted: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("creates user, talent profile in vetting stage 'applied', and links CV", async () => {
      const cvMock = {
        originalname: "cv.pdf",
        mimetype: "application/pdf",
        size: 1024,
        buffer: Buffer.from("CV-CONTENT"),
      };

      const result = await service.submitTalentApplication(
        {
          firstName: "Amine",
          lastName: "Bensalem",
          email: "amine@example.com",
          expectedNetPay: "2000.00",
          seniority: SeniorityLevel.senior,
          privacyPolicyAccepted: true,
        },
        cvMock,
        "127.0.0.1",
        "Mozilla/5.0",
      );

      expect(mockFilesService.uploadFile).toHaveBeenCalledWith(cvMock, "cv");
      expect(mockPrisma.users.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "amine@example.com",
          role: UserRole.talent,
        }),
      });
      expect(mockPrisma.talents.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          vettingStage: VettingStage.applied,
          status: TalentStatus.in_vetting,
        }),
      });
      expect(mockPrisma.talentDocuments.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.talentId).toBe("talent-1");
    });
  });

  describe("Public Referrer Registration (CDC §5.6 / 6.5)", () => {
    it("creates new referrer and returns unique referral tracking code", async () => {
      const result = await service.submitReferrerSignup(
        {
          name: "Sofiane K.",
          email: "sofiane@example.com",
          kind: ReferrerKind.partner,
          termsAccepted: true,
        },
        "127.0.0.1",
        "Mozilla/5.0",
      );

      expect(mockPrisma.referrers.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "sofiane@example.com",
          code: expect.stringMatching(/^REF-[A-Z0-9]+$/),
        }),
      });
      expect(mockPrisma.consents.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.referrerCode).toMatch(/^REF-[A-Z0-9]+$/);
    });
  });
});

