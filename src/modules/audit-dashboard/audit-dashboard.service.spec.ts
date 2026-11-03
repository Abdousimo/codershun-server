import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ForbiddenException } from "@nestjs/common";
import { AuditAction, UserRole } from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { AuditDashboardService } from "./audit-dashboard.service";

const resolved = <T>(value: T) => (jest.fn() as any).mockResolvedValue(value);

describe("AuditDashboardService", () => {
  let service: AuditDashboardService;
  let prisma: any;
  const finance: AuthenticatedUser = {
    id: "finance-1",
    email: "finance@example.com",
    role: UserRole.finance,
  };

  beforeEach(() => {
    prisma = {
      auditLog: {
        count: resolved(1),
        findMany: resolved([{ id: BigInt(1), entityType: "invoice" }]),
      },
      statusHistory: {
        count: resolved(1),
        findMany: resolved([{ id: BigInt(2), entityType: "placement" }]),
      },
      payouts: { count: resolved(2) },
      $queryRaw: jest.fn<any>()
        .mockResolvedValueOnce([
          {
            currency: "EUR",
            active_placements: BigInt(2),
            mrr: "4000",
            monthly_gross_margin: "1200",
            gross_margin_pct: "30",
          },
        ])
        .mockResolvedValueOnce([
          { id: "invoice-1", days_overdue: 16, balance_due: "100", bucket: "16_30" },
        ])
        .mockResolvedValueOnce([
          { id: "placement-1", contribution_margin: "700" },
        ]),
    };
    service = new AuditDashboardService(prisma);
  });

  it("lists audit records with filters and serializes bigint IDs", async () => {
    const result = await service.listAudit(
      { page: 1, pageSize: 25, entityType: "invoice", action: AuditAction.update },
      finance,
    );

    expect(result.data[0].id).toBe("1");
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: "invoice", action: AuditAction.update },
      }),
    );
  });

  it("lists status history with pagination", async () => {
    const result = await service.listStatusHistory({ page: 2, pageSize: 10 }, finance);

    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 1 });
    expect(result.data[0].id).toBe("2");
  });

  it("aggregates dashboard KPIs from the configured views", async () => {
    const result = await service.getDashboard(finance);

    expect(result.summary).toEqual({
      activePlacements: 2,
      mrr: "4000.00",
      monthlyGrossMargin: "1200.00",
      contributionMargin: "700.00",
      overdueInvoices: 1,
      payoutsDue: 2,
    });
  });

  it("denies audit and dashboard access to non-staff users", async () => {
    await expect(
      service.getDashboard({
        ...finance,
        role: UserRole.talent,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
