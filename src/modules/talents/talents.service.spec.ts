import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { BadRequestException } from "@nestjs/common";

import {
  Prisma,
  Recommendation,
  RejectCategory,
  SeniorityLevel,
  TalentStatus,
  UserRole,
  VettingStage,
  VettingStepType,
} from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { TalentsService } from "./talents.service";

describe("TalentsService", () => {
  let service: TalentsService;
  let mockPrisma: any;

  const recruiterUser: AuthenticatedUser = {
    id: "recruiter-uuid-1",
    email: "recruiter@codershub.dz",
    role: UserRole.recruiter,
    companyId: null,
    talentId: null,
    sessionId: "sess-1",
  };

  const recruiterLeadUser: AuthenticatedUser = {
    id: "lead-uuid-1",
    email: "lead@codershub.dz",
    role: UserRole.recruiter_lead,
    companyId: null,
    talentId: null,
    sessionId: "sess-2",
  };

  beforeEach(() => {
    mockPrisma = {
      talents: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        count: jest.fn<any>().mockResolvedValue(0),
        findFirst: jest.fn<any>().mockResolvedValue(null),
        findUnique: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({
            id: "talent-1",
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
        update: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({
            id: args.where.id,
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      },
      talentSkills: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      talentLanguages: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      talentExperiences: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "exp-1", ...args.data }),
        ),
      },
      talentEducations: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      talentCertifications: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      talentPortfolioItems: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      talentReferences: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      talentDocuments: {
        findMany: jest.fn<any>().mockResolvedValue([]),
      },
      vettingSteps: {
        findMany: jest.fn<any>().mockResolvedValue([]),
        findFirst: jest.fn<any>().mockResolvedValue(null),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "step-1", ...args.data }),
        ),
      },
      scorecards: {
        upsert: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "sc-1", ...args.create }),
        ),
      },
      scorecardScores: {
        deleteMany: jest.fn<any>().mockResolvedValue({ count: 1 }),
        create: jest.fn<any>().mockImplementation((args: any) =>
          Promise.resolve({ id: "sc-score-1", ...args.data }),
        ),
      },
      withUserContext: jest.fn<any>((user, fn) => fn(mockPrisma)),
    };

    service = new TalentsService(mockPrisma);
  });

  describe("Rule FR-TAL-03: Duplicate Detection & Re-apply Delay", () => {
    it("FR-TAL-03: rejects registration if candidate email already exists", async () => {
      mockPrisma.talents.findFirst.mockResolvedValue({
        id: "existing-talent",
        email: "duplicate@example.com",
      });

      await expect(
        service.createTalent(
          {
            firstName: "Dup",
            lastName: "User",
            email: "duplicate@example.com",
          },
          recruiterUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("FR-TAL-03: rejects re-application if 6-month delay period is still active", async () => {
      const activeDelayDate = new Date();
      activeDelayDate.setMonth(activeDelayDate.getMonth() + 3);

      mockPrisma.talents.findFirst.mockResolvedValue({
        id: "rejected-talent",
        email: "rejected@example.com",
        canReapplyAfter: activeDelayDate,
      });

      await expect(
        service.createTalent(
          {
            firstName: "Rejected",
            lastName: "User",
            email: "rejected@example.com",
          },
          recruiterUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("FR-TAL-03: sets default 6-month reapply delay when rejecting applicant", async () => {
      mockPrisma.talents.findFirst.mockResolvedValue({
        id: "talent-1",
        email: "talent@example.com",
        firstName: "Amine",
        lastName: "Bensalem",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.rejectTalent(
        "talent-1",
        {
          rejectCategory: RejectCategory.technical,
          rejectReason: "Did not meet senior threshold",
        },
        recruiterUser,
      );

      expect(result.vettingStage).toBe(VettingStage.rejected);
      expect(result.canReapplyAfter).toBeDefined();

      const reapplyDate = new Date(result.canReapplyAfter!);
      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 5);
      expect(reapplyDate.getTime()).toBeGreaterThan(sixMonthsFromNow.getTime());
    });
  });

  describe("Rule FR-TAL-04 & FR-SEC-01: Public Showcase & Anonymisation", () => {
    it("FR-TAL-04: queries only talents that are vetted, showcaseOptIn=true, showcaseConsentAt!=null, and published", async () => {
      mockPrisma.talents.findMany.mockResolvedValue([]);
      mockPrisma.talents.count.mockResolvedValue(0);

      await service.getPublicShowcase({ seniority: SeniorityLevel.senior, page: 1, pageSize: 10 });

      expect(mockPrisma.talents.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vettingStage: VettingStage.vetted,
            showcaseOptIn: true,
            showcaseConsentAt: { not: null },
            showcasePublished: true,
            isBlacklisted: false,
            seniority: SeniorityLevel.senior,
          }),
        }),
      );
    });

    it("FR-SEC-01: returns anonymised showcase profile without exposing personal contact details or pay", async () => {
      mockPrisma.talents.findMany.mockResolvedValue([
        {
          id: "talent-sec-1",
          firstName: "Karim",
          lastName: "Mansouri",
          email: "private.karim@gmail.com",
          phone: "+213555123456",
          expectedPay: new Prisma.Decimal("2200.00"),
          agreedPay: new Prisma.Decimal("2000.00"),
          headline: "Lead Cloud Architect",
          seniority: SeniorityLevel.lead,
          yearsExperience: new Prisma.Decimal("8.0"),
          vettingScore: new Prisma.Decimal("92.50"),
          publicDisplayName: "Karim M.",
          publicSlug: "karim-m-cloud-architect",
          vettingStage: VettingStage.vetted,
          showcaseOptIn: true,
          showcaseConsentAt: new Date(),
          showcasePublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockPrisma.talents.count.mockResolvedValue(1);

      mockPrisma.talentExperiences.findMany.mockResolvedValue([
        {
          id: "exp-1",
          talentId: "talent-sec-1",
          companyName: "Secret Defence Contractor",
          publicCompanyLabel: "Fintech scaleup, France",
          hideCompanyName: true,
          title: "Principal Architect",
          startDate: new Date("2022-01-01"),
          endDate: null,
          technologies: ["AWS", "Kubernetes", "Terraform"],
        },
      ]);

      const result = await service.getPublicShowcase({ page: 1, pageSize: 10 });

      expect(result.data).toHaveLength(1);
      const profile = result.data[0];

      // Verifies public pseudonym and public slug
      expect(profile.displayName).toBe("Karim M.");
      expect(profile.publicSlug).toBe("karim-m-cloud-architect");

      // Verifies sensitive fields are NOT present
      expect((profile as any).email).toBeUndefined();
      expect((profile as any).phone).toBeUndefined();
      expect((profile as any).expectedPay).toBeUndefined();
      expect((profile as any).agreedPay).toBeUndefined();
      expect((profile as any).margin).toBeUndefined();

      // Verifies company name anonymisation
      expect(profile.experiences[0].companyLabel).toBe("Fintech scaleup, France");
      expect((profile.experiences[0] as any).companyName).toBeUndefined();
    });
  });

  describe("Approval & Scorecards (CDC §6.1)", () => {
    it("approves candidate and assigns seniority, agreed pay, and public pseudonym", async () => {
      mockPrisma.talents.findFirst.mockResolvedValue({
        id: "talent-1",
        firstName: "Amine",
        lastName: "Bensalem",
        email: "amine@example.com",
        showcaseOptIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.approveTalent(
        "talent-1",
        {
          seniority: SeniorityLevel.senior,
          agreedPay: "2000.00",
          showcasePublished: true,
          publicDisplayName: "Amine B.",
        },
        recruiterLeadUser,
      );

      expect(result.vettingStage).toBe(VettingStage.vetted);
      expect(result.status).toBe(TalentStatus.available);
      expect(result.seniority).toBe(SeniorityLevel.senior);
      expect(result.agreedPay).toBe("2000.00");
      expect(result.publicDisplayName).toBe("Amine B.");
      expect(result.showcasePublished).toBe(true);
    });

    it("submits technical scorecard and recalculates talent vetting score", async () => {
      mockPrisma.talents.findFirst.mockResolvedValue({
        id: "talent-1",
        firstName: "Amine",
        lastName: "Bensalem",
        email: "amine@example.com",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.submitScorecard(
        "talent-1",
        {
          totalScore: "87.50",
          recommendation: Recommendation.strong_yes,
          scores: [
            { criterion: "System Design", score: 90 },
            { criterion: "Data Structures", score: 85 },
          ],
        },
        recruiterUser,
      );

      expect(mockPrisma.scorecards.upsert).toHaveBeenCalled();
      expect(mockPrisma.scorecardScores.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.talents.update).toHaveBeenCalledWith({
        where: { id: "talent-1" },
        data: expect.objectContaining({
          vettingScore: expect.any(Object),
        }),
      });
    });
  });
});
