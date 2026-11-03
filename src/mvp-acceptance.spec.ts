import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { NotificationChannel, UserRole } from "./generated/prisma/client";
import type { AuthenticatedUser } from "./common/types/authenticated-user";
import { PricingService } from "./modules/settings/pricing.service";
import { NotificationsService } from "./modules/notifications/notifications.service";
import { ReferralsService } from "./modules/referrals/referrals.service";
import { AuditDashboardService } from "./modules/audit-dashboard/audit-dashboard.service";

const resolved = <T>(value: T) => (jest.fn() as any).mockResolvedValue(value);

describe("MVP acceptance regression suite", () => {
  const admin: AuthenticatedUser = {
    id: "admin-1",
    email: "admin@example.com",
    role: UserRole.super_admin,
  };

  it("accepts the CDC pricing example: €1,200 pay at 40% margin gives €2,000 and €800", async () => {
    const prisma = {
      rateCardVersions: {
        findFirst: resolved(null),
        findUnique: resolved(null),
      },
      rateCardEntries: { findMany: resolved([]) },
      discountRules: { findMany: resolved([]) },
    };
    const service = new PricingService(prisma as any);

    const result = await service.calculatePricing({
      talentNetPay: "1200.00",
      targetMarginPct: "40.00",
    } as any);

    expect(result.grossClientPrice).toBe("2000.00");
    expect(result.grossMarginAmount).toBe("800.00");
  });

  it("honors notification preferences in the user journey", async () => {
    const prisma = {
      notificationPreferences: {
        findUnique: resolved({ enabled: false }),
      },
      emailTemplates: {
        findFirst: resolved({ id: "template-1" }),
      },
      notifications: { create: jest.fn<any>() },
    };
    const service = new NotificationsService(prisma as any);

    const result = await service.create(
      {
        userId: "user-1",
        type: "invoice.issued",
        channel: NotificationChannel.email,
        recipientEmail: "user@example.com",
        templateCode: "invoice-issued",
      },
      admin,
    );

    expect(result).toBeNull();
    expect(prisma.notifications.create).not.toHaveBeenCalled();
  });

  it("blocks referral self-attribution", async () => {
    const prisma = {
      referrers: {
        findUnique: resolved({ id: "referrer-1", isActive: true, companyId: "company-1" }),
      },
    };
    const service = new ReferralsService(prisma as any);

    await expect(
      service.create(
        {
          referrerId: "referrer-1",
          companyId: "company-1",
          introCompanyName: "Own company",
          introContactName: "Owner",
          introContactEmail: "owner@example.com",
          introNeed: "Developer",
        },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("restricts dashboard access to staff", async () => {
    const service = new AuditDashboardService({} as any);

    await expect(
      service.getDashboard({
        ...admin,
        role: UserRole.talent,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
