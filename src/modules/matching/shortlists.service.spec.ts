import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { UnprocessableEntityException, BadRequestException } from "@nestjs/common";
import {
  ClientDecision,
  Prisma,
  RequestStatus,
  SeniorityLevel,
  ShortlistStatus,
  TalentStatus,
  UserRole,
  VettingStage,
} from "../../generated/prisma/client";
import { ShortlistsService } from "./shortlists.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

describe("ShortlistsService", () => {
  let service: ShortlistsService;
  let mockPrisma: any;
  let mockPricingService: any;
  let mockMatchingService: any;

  const adminUser: AuthenticatedUser = {
    id: "admin-uuid-1",
    email: "admin@codershub.dz",
    role: UserRole.super_admin,
  };

  const clientUser: AuthenticatedUser = {
    id: "client-uuid-1",
    email: "client@clientcorp.com",
    role: UserRole.client_admin,
    companyId: "company-1",
  };

  beforeEach(() => {
    mockPrisma = {
      shortlists: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      shortlistItems: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn(),
        delete: jest.fn(),
      },
      talentRequests: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      talentRequestSkills: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      talentRequestLanguages: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      talents: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      talentSkills: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      talentLanguages: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      skills: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      withUserContext: jest.fn().mockImplementation((_user, cb) => cb(mockPrisma)),
    };

    mockPricingService = {
      calculatePricing: jest.fn().mockResolvedValue({
        netClientPrice: "2200.00",
      }),
    };

    mockMatchingService = {
      getWeights: jest.fn().mockResolvedValue({
        skills: 50,
        seniority: 20,
        availability: 15,
        language: 10,
        vetting: 5,
      }),
      calculateMatchBreakdown: jest.fn().mockReturnValue({
        skills: 45,
        seniority: 20,
        availability: 15,
        language: 10,
        vetting: 4.5,
      }),
    };

    service = new ShortlistsService(mockPrisma, mockPricingService, mockMatchingService);
  });

  describe("FR-TAL-01: Vetted & Available Validation for Shortlists", () => {
    it("FR-TAL-01: rejects adding talent if vettingStage is NOT vetted", async () => {
      mockPrisma.shortlists.findUnique.mockResolvedValue({
        id: "shortlist-1",
        requestId: "req-1",
        status: ShortlistStatus.draft,
      });
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        seniority: SeniorityLevel.senior,
        timeSharePct: 100,
      });
      mockPrisma.talents.findUnique.mockResolvedValue({
        id: "talent-1",
        vettingStage: VettingStage.technical_review, // NOT vetted
        status: TalentStatus.available,
        isBlacklisted: false,
      });

      await expect(
        service.addItem(
          "shortlist-1",
          { talentId: "talent-1" },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await service.addItem(
          "shortlist-1",
          { talentId: "talent-1" },
          adminUser,
        );
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: "FR-TAL-01",
          }),
        );
      }
    });

    it("FR-TAL-01: rejects adding talent if talent status is placed or inactive", async () => {
      mockPrisma.shortlists.findUnique.mockResolvedValue({
        id: "shortlist-1",
        requestId: "req-1",
        status: ShortlistStatus.draft,
      });
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        seniority: SeniorityLevel.senior,
        timeSharePct: 100,
      });
      mockPrisma.talents.findUnique.mockResolvedValue({
        id: "talent-1",
        vettingStage: VettingStage.vetted,
        status: TalentStatus.placed, // Already placed, not available
        isBlacklisted: false,
      });

      await expect(
        service.addItem(
          "shortlist-1",
          { talentId: "talent-1" },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("FR-TAL-01: rejects adding talent if talent is blacklisted", async () => {
      mockPrisma.shortlists.findUnique.mockResolvedValue({
        id: "shortlist-1",
        requestId: "req-1",
        status: ShortlistStatus.draft,
      });
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        seniority: SeniorityLevel.senior,
        timeSharePct: 100,
      });
      mockPrisma.talents.findUnique.mockResolvedValue({
        id: "talent-1",
        vettingStage: VettingStage.vetted,
        status: TalentStatus.available,
        isBlacklisted: true, // Blacklisted
      });

      await expect(
        service.addItem(
          "shortlist-1",
          { talentId: "talent-1" },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it("FR-TAL-01: successfully adds talent when vetted, available, and not blacklisted", async () => {
      mockPrisma.shortlists.findUnique.mockResolvedValue({
        id: "shortlist-1",
        requestId: "req-1",
        version: 1,
        status: ShortlistStatus.draft,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        seniority: SeniorityLevel.mid,
        timeSharePct: 100,
        budgetCurrency: "EUR",
      });
      mockPrisma.talents.findUnique.mockResolvedValue({
        id: "talent-1",
        firstName: "Karim",
        lastName: "Bensaid",
        email: "karim@example.com",
        vettingStage: VettingStage.vetted,
        status: TalentStatus.available,
        isBlacklisted: false,
        agreedPay: new Prisma.Decimal("1200.00"),
      });

      await service.addItem(
        "shortlist-1",
        {
          talentId: "talent-1",
          recruiterNote: "Exceptional system design experience",
        },
        adminUser,
      );

      expect(mockPrisma.shortlistItems.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            shortlistId_talentId: {
              shortlistId: "shortlist-1",
              talentId: "talent-1",
            },
          },
        }),
      );
    });
  });

  describe("FR-SEC-01: Anonymisation for Client Portal and Public Share Link", () => {
    it("FR-SEC-01: strips personal email, phone, and talent agreed pay in client shortlist view", async () => {
      mockPrisma.shortlists.findUnique.mockResolvedValue({
        id: "shortlist-1",
        requestId: "req-1",
        version: 1,
        status: ShortlistStatus.published,
        publishedAt: new Date(),
      });
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        companyId: "company-1",
        roleTitle: "Fullstack Node/React Developer",
      });
      mockPrisma.shortlistItems.findMany.mockResolvedValue([
        {
          id: "item-1",
          talentId: "talent-1",
          matchScore: new Prisma.Decimal("92.5"),
          recruiterNote: "Strong candidate with 6+ years experience",
          proposedClientPrice: new Prisma.Decimal("2400.00"),
          proposedCurrency: "EUR",
          clientDecision: ClientDecision.pending,
          sortOrder: 0,
        },
      ]);
      mockPrisma.talents.findMany.mockResolvedValue([
        {
          id: "talent-1",
          firstName: "SecretFirstName",
          lastName: "SecretLastName",
          email: "confidential@private.com",
          phone: "+213555123456",
          whatsapp: "+213555123456",
          agreedPay: new Prisma.Decimal("1300.00"),
          publicSlug: "dev-algiers-42",
          headline: "Senior Full Stack TypeScript Specialist",
          seniority: SeniorityLevel.senior,
          yearsExperience: new Prisma.Decimal("6.5"),
          city: "Algiers",
          countryCode: "DZ",
          summary: "Passionate developer specialized in cloud microservices.",
        },
      ]);
      mockPrisma.talentSkills.findMany.mockResolvedValue([
        { talentId: "talent-1", skillId: "skill-1" },
      ]);
      mockPrisma.talentLanguages.findMany.mockResolvedValue([
        { talentId: "talent-1", languageCode: "en", level: "C1" },
      ]);
      mockPrisma.skills.findMany.mockResolvedValue([
        { id: "skill-1", name: "Node.js" },
      ]);

      const result = await service.findClientShortlistById("shortlist-1", clientUser);

      expect(result.items).toHaveLength(1);
      const item = result.items[0];

      // Public data present
      expect(item.publicSlug).toBe("dev-algiers-42");
      expect(item.roleTitle).toBe("Senior Full Stack TypeScript Specialist");
      expect(item.proposedClientPrice).toBe("2400.00");
      expect(item.skills).toContain("Node.js");
      expect(item.languages).toContain("EN (C1)");

      // FR-SEC-01 strictly anonymised
      expect((item as any).firstName).toBeUndefined();
      expect((item as any).lastName).toBeUndefined();
      expect((item as any).email).toBeUndefined();
      expect((item as any).phone).toBeUndefined();
      expect((item as any).agreedTalentPay).toBeUndefined();
      expect((item as any).margin).toBeUndefined();
    });
  });

  describe("Shortlist Publishing & Client Decisions", () => {
    it("publishing a shortlist generates share token, sets status to published, and transitions request to shortlist_sent", async () => {
      mockPrisma.shortlists.findUnique.mockResolvedValue({
        id: "shortlist-1",
        requestId: "req-1",
        version: 1,
        status: ShortlistStatus.draft,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.shortlistItems.findMany.mockResolvedValue([
        { id: "item-1", talentId: "talent-1" },
      ]);
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        firstShortlistAt: null,
      });

      const res = await service.publishShortlist("shortlist-1", adminUser);

      expect(res.shareToken).toBeDefined();
      expect(res.shareUrl).toContain("/api/v1/public/shortlists/share/");
      expect(mockPrisma.shortlists.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "shortlist-1" },
          data: expect.objectContaining({
            status: ShortlistStatus.published,
          }),
        }),
      );
      expect(mockPrisma.talentRequests.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: RequestStatus.shortlist_sent,
          }),
        }),
      );
    });

    it("requires reason when client marks a candidate as not_a_fit", async () => {
      mockPrisma.shortlists.findUnique.mockResolvedValue({
        id: "shortlist-1",
        requestId: "req-1",
      });
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        companyId: "company-1",
      });
      mockPrisma.shortlistItems.findUnique.mockResolvedValue({
        id: "item-1",
        shortlistId: "shortlist-1",
        talentId: "talent-1",
      });

      await expect(
        service.recordClientDecision(
          "shortlist-1",
          "talent-1",
          {
            decision: ClientDecision.not_a_fit,
            reason: undefined, // Missing reason
          },
          clientUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
