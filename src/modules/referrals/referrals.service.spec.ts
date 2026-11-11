import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import {
  PaymentMethod,
  Prisma,
  ReferralStatus,
  RewardStatus,
  RewardType,
  UserRole,
} from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ReferralsService } from "./referrals.service";

const resolved = <T>(value: T) => (jest.fn() as any).mockResolvedValue(value);

describe("ReferralsService", () => {
  let service: ReferralsService;
  let prisma: any;
  const sales: AuthenticatedUser = {
    id: "sales-1",
    email: "sales@example.com",
    role: UserRole.sales,
  };
  const finance: AuthenticatedUser = {
    id: "finance-1",
    email: "finance@example.com",
    role: UserRole.finance,
  };
  const referral = {
    id: "referral-1",
    referrerId: "referrer-1",
    companyId: "company-1",
    leadId: "lead-1",
    referredTalentId: null,
    introCompanyName: "Acme",
    introContactName: "Jane Doe",
    introContactEmail: "jane@acme.test",
    introNeed: "One developer",
    status: ReferralStatus.submitted,
    attributedAt: new Date(),
    attributionExpiresAt: new Date(Date.now() + 86_400_000),
  };
  const reward = {
    id: "reward-1",
    referralId: "referral-1",
    rewardRuleId: "rule-1",
    rewardType: RewardType.monthly_plan,
    amount: "300",
    currency: "EUR",
    status: RewardStatus.pending,
    paidInvoicesCount: 0,
    trialPassed: false,
    fees: "0",
    paymentMethod: null,
    paymentReference: null,
    payableAt: null,
    paidAt: null,
  };

  beforeEach(() => {
    prisma = {
      referrers: {
        findUnique: resolved({ id: "referrer-1", isActive: true, companyId: "other-company" }),
        findFirst: resolved({ id: "referrer-1", code: "REF-TEST-001", isActive: true }),
        create: resolved({ id: "referrer-1", code: "REF-TEST-001", isActive: true }),
      },
      referrals: {
        create: resolved(referral),
        findUnique: resolved(referral),
        findFirst: resolved(null),
        findMany: resolved([]),
        count: resolved(1),
        update: resolved({ ...referral, status: ReferralStatus.contacted }),
      },
      referralRewards: {
        create: resolved(reward),
        findUnique: resolved(reward),
        findMany: resolved([reward]),
        update: resolved({ ...reward, status: RewardStatus.payable }),
      },
      referralRewardRules: {
        findFirst: resolved({ id: "rule-1", baseAmount: "300", currency: "EUR", paidInvoicesRequired: 2 }),
        findUnique: resolved({ id: "rule-1", paidInvoicesRequired: 2 }),
      },
      withUserContext: jest.fn<any>().mockImplementation(
        (_user: AuthenticatedUser, callback: (tx: any) => unknown) => callback(prisma),
      ),
    };
    service = new ReferralsService(prisma);
  });

  it("FR-REF-01: creates first-touch attribution with a 90-day expiry", async () => {
    await service.create(
      {
        referrerId: "referrer-1",
        companyId: "company-1",
        leadId: "lead-1",
        introCompanyName: "Acme",
        introContactName: "Jane Doe",
        introContactEmail: "jane@acme.test",
        introNeed: "One developer",
      },
      sales,
    );

    const data = prisma.referrals.create.mock.calls[0][0].data;
    expect(data.attributionExpiresAt.getTime() - data.attributedAt.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("FR-REF-01: blocks self-referral", async () => {
    prisma.referrers.findUnique.mockResolvedValueOnce({
      id: "referrer-1",
      isActive: true,
      companyId: "company-1",
    });

    await expect(
      service.create(
        {
          referrerId: "referrer-1",
          companyId: "company-1",
          introCompanyName: "Acme",
          introContactName: "Jane Doe",
          introContactEmail: "jane@acme.test",
          introNeed: "One developer",
        },
        sales,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("FR-REF-01: requires two paid invoices and a passed trial before payable", async () => {
    await expect(
      service.markRewardPayable(
        "reward-1",
        { paidInvoicesCount: 1, trialPassed: true },
        finance,
      ),
    ).rejects.toThrow(BadRequestException);

    await service.markRewardPayable(
      "reward-1",
      { paidInvoicesCount: 2, trialPassed: true },
      finance,
    );
    expect(prisma.referralRewards.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: RewardStatus.payable }),
      }),
    );
  });

  it("FR-REF-01: records payment details only for payable rewards", async () => {
    prisma.referralRewards.findUnique.mockResolvedValueOnce({
      ...reward,
      status: RewardStatus.payable,
    });

    await service.payReward(
      "reward-1",
      {
        paymentMethod: PaymentMethod.payoneer,
        paymentReference: "PAY-123",
        fees: "5.00",
      },
      finance,
    );

    expect(prisma.referralRewards.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: RewardStatus.paid,
          paymentMethod: PaymentMethod.payoneer,
          paymentReference: "PAY-123",
        }),
      }),
    );
  });

  it("denies referral access to unauthorized roles", async () => {
    await expect(
      service.findAll({ page: 1, pageSize: 25 }, {
        ...sales,
        role: UserRole.talent,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  describe("Talent Referral Portal", () => {
    const talentUser: AuthenticatedUser = {
      id: "talent-user-1",
      email: "talent@example.com",
      role: UserRole.talent,
    };

    it("returns referral profile, shareable URL, and reward ledger for talent", async () => {
      prisma.referrals.findMany = resolved([
        {
          id: "ref-1",
          referrerId: "referrer-1",
          referralKind: "client",
          introCompanyName: "Fintech Hub",
          introContactName: "Alexandre",
          introContactEmail: "alex@fintech.test",
          introNeed: "Senior backend developer",
          status: ReferralStatus.won,
          attributedAt: new Date("2026-11-01T00:00:00Z"),
        },
      ]);

      prisma.referralRewards.findMany = resolved([
        {
          id: "rw-1",
          referralId: "ref-1",
          amount: new Prisma.Decimal("500.00"),
          currency: "EUR",
          status: RewardStatus.paid,
        },
      ]);

      const profile = await service.getTalentReferralProfile(talentUser);

      expect(profile.referrerId).toBe("referrer-1");
      expect(profile.code).toBe("REF-TEST-001");
      expect(profile.shareableUrl).toBe("https://codershub.dz/r/REF-TEST-001");
      expect(profile.rewardPerReferralEur).toBe(500);
      expect(profile.totalEarnedEur).toBe(500);
      expect(profile.referralsCount).toBe(1);
      expect(profile.successfulReferralsCount).toBe(1);
      expect(profile.referrals[0].introCompanyName).toBe("Fintech Hub");
    });

    it("allows talent to submit a referral and initializes a pending reward", async () => {
      const result = await service.submitTalentReferral(
        {
          introCompanyName: "Startup Alpha",
          introContactName: "John Founder",
          introContactEmail: "john@alpha.test",
          introNeed: "Looking for 2 React devs",
          referralKind: "client",
        },
        talentUser,
      );

      expect(result.success).toBe(true);
      expect(prisma.referrals.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referrerId: "referrer-1",
            introCompanyName: "Startup Alpha",
            introContactEmail: "john@alpha.test",
            status: ReferralStatus.submitted,
          }),
        }),
      );
      expect(prisma.referralRewards.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rewardType: "flat_bonus",
            currency: "EUR",
            status: RewardStatus.pending,
          }),
        }),
      );
    });
  });
});
