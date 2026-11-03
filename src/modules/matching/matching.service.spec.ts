import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  CefrLevel,
  Prisma,
  SeniorityLevel,
  SkillLevel,
  TalentStatus,
  VettingStage,
} from "../../generated/prisma/client";
import { MatchingService } from "./matching.service";

describe("MatchingService", () => {
  let service: MatchingService;
  let mockPrisma: any;
  let mockSettingsService: any;
  let mockPricingService: any;

  beforeEach(() => {
    mockPrisma = {
      talentRequests: {
        findUnique: jest.fn(),
      },
      talentRequestSkills: {
        findMany: jest.fn(),
      },
      talentRequestLanguages: {
        findMany: jest.fn(),
      },
      talents: {
        findMany: jest.fn(),
      },
      talentSkills: {
        findMany: jest.fn(),
      },
      talentLanguages: {
        findMany: jest.fn(),
      },
      shortlists: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      shortlistItems: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      skills: {
        findMany: jest.fn().mockResolvedValue([
          { id: "skill-react", name: "React" },
          { id: "skill-node", name: "Node.js" },
          { id: "skill-python", name: "Python" },
        ]),
      },
    };

    mockSettingsService = {
      getSettingByKey: jest.fn().mockResolvedValue({
        value: {
          skills: 50,
          seniority: 20,
          availability: 15,
          language: 10,
          vetting: 5,
        },
      }),
    };

    mockPricingService = {
      calculatePricing: jest.fn().mockResolvedValue({
        netClientPrice: "2100.00",
      }),
    };

    service = new MatchingService(mockPrisma, mockSettingsService, mockPricingService);
  });

  describe("Candidate Pool Matching and Scoring", () => {
    it("ranks candidate with full skill and seniority match higher than partial match", async () => {
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        roleTitle: "Fullstack React/Node Engineer",
        seniority: SeniorityLevel.senior,
        timeSharePct: 100,
        desiredStartDate: new Date("2026-07-01"),
      });

      mockPrisma.talentRequestSkills.findMany.mockResolvedValue([
        { skillId: "skill-react", isRequired: true, minLevel: SkillLevel.advanced },
        { skillId: "skill-node", isRequired: true, minLevel: SkillLevel.advanced },
      ]);

      mockPrisma.talentRequestLanguages.findMany.mockResolvedValue([
        { languageCode: "en", minLevel: CefrLevel.B2 },
      ]);

      // Candidate 1: Full match (React expert, Node advanced, English C1, Senior, Available)
      // Candidate 2: Partial match (React intermediate, missing Node, English B1, Mid)
      mockPrisma.talents.findMany.mockResolvedValue([
        {
          id: "cand-1",
          seniority: SeniorityLevel.senior,
          status: TalentStatus.available,
          availabilityDate: new Date("2026-06-15"),
          timeSharePct: 100,
          vettingScore: new Prisma.Decimal("95.0"),
          headline: "Expert Fullstack React & Node Developer",
          agreedPay: new Prisma.Decimal("2000.00"),
        },
        {
          id: "cand-2",
          seniority: SeniorityLevel.mid,
          status: TalentStatus.proposed,
          availabilityDate: new Date("2026-08-15"),
          timeSharePct: 100,
          vettingScore: new Prisma.Decimal("70.0"),
          headline: "Junior/Mid React Dev",
          agreedPay: new Prisma.Decimal("1200.00"),
        },
      ]);

      mockPrisma.talentSkills.findMany.mockResolvedValue([
        { talentId: "cand-1", skillId: "skill-react", level: SkillLevel.expert },
        { talentId: "cand-1", skillId: "skill-node", level: SkillLevel.advanced },
        { talentId: "cand-2", skillId: "skill-react", level: SkillLevel.intermediate },
      ]);

      mockPrisma.talentLanguages.findMany.mockResolvedValue([
        { talentId: "cand-1", languageCode: "en", level: CefrLevel.C1 },
        { talentId: "cand-2", languageCode: "en", level: CefrLevel.B1 },
      ]);

      const results = await service.findMatchesForRequest("req-1");

      expect(results).toHaveLength(2);
      expect(results[0].talentId).toBe("cand-1");
      expect(results[1].talentId).toBe("cand-2");

      expect(results[0].matchScore).toBeGreaterThan(results[1].matchScore);
      expect(results[0].matchedSkills).toEqual(["React", "Node.js"]);
      expect(results[0].missingSkills).toEqual([]);
      expect(results[1].missingSkills).toEqual(["Node.js"]);
    });
  });
});
