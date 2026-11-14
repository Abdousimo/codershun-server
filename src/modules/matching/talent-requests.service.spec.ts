import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { UnprocessableEntityException } from "@nestjs/common";
import { LostReason, RequestStatus, SeniorityLevel, UserRole } from "../../generated/prisma/client";
import { TalentRequestsService } from "./talent-requests.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";

describe("TalentRequestsService", () => {
  let service: TalentRequestsService;
  let mockPrisma: any;
  let mockPricingService: any;
  let mockSettingsService: any;

  const adminUser: AuthenticatedUser = {
    id: "admin-uuid-1",
    email: "admin@codershub.dz",
    role: UserRole.super_admin,
  };

  beforeEach(() => {
    mockPrisma = {
      companies: {
        findUnique: jest.fn(),
      },
      invoices: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
      },
      talentRequests: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      talentRequestSkills: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      talentRequestLanguages: {
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      skills: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      shortlists: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      companies: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      users: {
        findUnique: jest.fn(),
      },
      withUserContext: jest.fn().mockImplementation((_user, cb) => cb(mockPrisma)),
    };

    mockPricingService = {
      calculatePricing: jest.fn().mockResolvedValue({
        netClientPrice: "2000.00",
      }),
    };

    mockSettingsService = {
      getSettingByKey: jest.fn().mockResolvedValue({ value: "48" }),
    };

    service = new TalentRequestsService(mockPrisma, mockPricingService, mockSettingsService);
  });

  describe("FR-REQ-01: SLA 48-Hour Deadline and Countdown", () => {
    it("computes normal SLA stage when request is freshly created within 24h", () => {
      const now = new Date("2026-06-01T10:00:00Z");
      const createdAt = new Date("2026-06-01T00:00:00Z"); // 10h elapsed
      const slaDeadlineAt = new Date("2026-06-03T00:00:00Z"); // +48h

      const status = service.computeSlaStatus(
        {
          createdAt,
          slaDeadlineAt,
          status: RequestStatus.open,
        },
        now,
      );

      expect(status.slaBreached).toBe(false);
      expect(status.slaRemainingHours).toBe(38);
      expect(status.slaWarningStage).toBe("normal");
    });

    it("FR-REQ-01: computes warn_24h stage when >= 24h elapsed without a shortlist", () => {
      const now = new Date("2026-06-02T02:00:00Z");
      const createdAt = new Date("2026-06-01T00:00:00Z"); // 26h elapsed
      const slaDeadlineAt = new Date("2026-06-03T00:00:00Z");

      const status = service.computeSlaStatus(
        {
          createdAt,
          slaDeadlineAt,
          status: RequestStatus.open,
        },
        now,
      );

      expect(status.slaBreached).toBe(false);
      expect(status.slaWarningStage).toBe("warn_24h");
    });

    it("FR-REQ-01: computes warn_40h stage when >= 40h elapsed without a shortlist", () => {
      const now = new Date("2026-06-02T18:00:00Z");
      const createdAt = new Date("2026-06-01T00:00:00Z"); // 42h elapsed
      const slaDeadlineAt = new Date("2026-06-03T00:00:00Z");

      const status = service.computeSlaStatus(
        {
          createdAt,
          slaDeadlineAt,
          status: RequestStatus.sourcing,
        },
        now,
      );

      expect(status.slaBreached).toBe(false);
      expect(status.slaWarningStage).toBe("warn_40h");
    });

    it("FR-REQ-01: computes breached SLA stage when deadline has passed", () => {
      const now = new Date("2026-06-03T05:00:00Z");
      const createdAt = new Date("2026-06-01T00:00:00Z");
      const slaDeadlineAt = new Date("2026-06-03T00:00:00Z"); // expired 5h ago

      const status = service.computeSlaStatus(
        {
          createdAt,
          slaDeadlineAt,
          status: RequestStatus.open,
        },
        now,
      );

      expect(status.slaBreached).toBe(true);
      expect(status.slaRemainingHours).toBe(-5);
      expect(status.slaWarningStage).toBe("breached");
    });

    it("FR-REQ-01: does not mark breached if firstShortlistAt was fulfilled", () => {
      const now = new Date("2026-06-04T00:00:00Z");
      const createdAt = new Date("2026-06-01T00:00:00Z");
      const slaDeadlineAt = new Date("2026-06-03T00:00:00Z");
      const firstShortlistAt = new Date("2026-06-02T12:00:00Z"); // sent within 36h

      const status = service.computeSlaStatus(
        {
          createdAt,
          slaDeadlineAt,
          firstShortlistAt,
          status: RequestStatus.shortlist_sent,
        },
        now,
      );

      expect(status.slaBreached).toBe(false);
      expect(status.slaWarningStage).toBe("normal");
    });
  });

  describe("FR-REQ-02: Lost Reason Enforcement", () => {
    it("FR-REQ-02: throws 422 UnprocessableEntityException when status updated to lost without lostReason", async () => {
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        companyId: "comp-1",
        status: RequestStatus.sourcing,
      });

      await expect(
        service.updateStatus(
          "req-1",
          {
            status: RequestStatus.lost,
            lostReason: undefined,
          },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      try {
        await service.updateStatus(
          "req-1",
          {
            status: RequestStatus.lost,
            lostReason: undefined,
          },
          adminUser,
        );
      } catch (err: any) {
        expect(err.getResponse()).toEqual(
          expect.objectContaining({
            code: "FR-REQ-02",
          }),
        );
      }
    });

    it("FR-REQ-02: successfully updates status to lost when lostReason is provided", async () => {
      mockPrisma.talentRequests.findUnique.mockResolvedValue({
        id: "req-1",
        companyId: "comp-1",
        status: RequestStatus.sourcing,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.talentRequests.update.mockResolvedValue({ id: "req-1" });

      const res = await service.updateStatus(
        "req-1",
        {
          status: RequestStatus.lost,
          lostReason: LostReason.competitor,
        },
        adminUser,
      );

      expect(mockPrisma.talentRequests.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "req-1" },
          data: expect.objectContaining({
            status: RequestStatus.lost,
            lostReason: LostReason.competitor,
          }),
        }),
      );
    });

    it("FR-BILL-03: blocks new talent requests if company has unpaid invoices overdue by > 30 days", async () => {
      mockPrisma.companies.findUnique.mockResolvedValue({ id: "comp-1", name: "Late Payer Ltd" });
      mockPrisma.invoices.findFirst.mockResolvedValue({
        id: "inv-overdue-1",
        number: "INV-2026-0001",
      });

      await expect(
        service.createRequest(
          {
            companyId: "comp-1",
            roleTitle: "Backend Developer",
            engagementModel: "full_time" as any,
            talentsCount: 1,
            timeSharePct: 100,
          },
          adminUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
