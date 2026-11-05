import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import { PayoutLineKind, PayoutStatus, PaymentMethod, UserRole } from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PayoutsService } from "./payouts.service";

const resolved = <T>(value: T) => (jest.fn() as any).mockResolvedValue(value);

describe("PayoutsService", () => {
  let service: PayoutsService;
  let prisma: any;
  const finance: AuthenticatedUser = {
    id: "finance-1",
    email: "finance@example.com",
    role: UserRole.finance,
  };
  const pending = {
    id: "payout-1",
    talentId: "talent-1",
    periodMonth: new Date("2026-02-01"),
    status: PayoutStatus.pending,
    currency: "EUR",
    grossAmount: "0",
    adjustmentsTotal: "0",
    netAmount: "0",
    fees: "0",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      talents: { findUnique: resolved({ id: "talent-1" }) },
      placements: { findUnique: resolved({ id: "placement-1", talentId: "talent-1" }) },
      payouts: {
        create: resolved(pending),
        findUnique: resolved(pending),
        update: resolved({ ...pending, status: PayoutStatus.approved }),
        count: resolved(1),
        findMany: resolved([]),
      },
      payoutLines: {
        create: jest.fn<any>(),
        findMany: resolved([]),
      },
      withUserContext: jest.fn<any>().mockImplementation(
        (_user: AuthenticatedUser, callback: (tx: any) => unknown) => callback(prisma),
      ),
    };
    service = new PayoutsService(prisma, { uploadFile: resolved({ id: "file-1" }) } as any);
  });

  it("FR-PAY-01: creates a payout for the immediately previous month", async () => {
    const now = new Date();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

    await service.create(
      { talentId: "talent-1", periodMonth: previous.toISOString(), currency: "eur" },
      finance,
    );

    expect(prisma.payouts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ periodMonth: previous, currency: "EUR" }),
      }),
    );
  });

  it("FR-PAY-01: rejects a payout for a month other than the previous month", async () => {
    await expect(
      service.create(
        { talentId: "talent-1", periodMonth: "2020-01-01", currency: "EUR" },
        finance,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("FR-PAY-02: records currency, FX rate, fees, method and transfer reference", async () => {
    prisma.payouts.findUnique.mockResolvedValueOnce({ ...pending, status: PayoutStatus.approved });

    await service.markPaid(
      "payout-1",
      {
        paidCurrency: "DZD",
        paidAmount: 220000,
        fxRate: 110,
        fees: 12,
        method: PaymentMethod.local_transfer,
        transferReference: "TRX-123",
      },
      finance,
    );

    expect(prisma.payouts.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidCurrency: "DZD",
          paidAmount: expect.anything(),
          fxRate: expect.anything(),
          fees: expect.anything(),
          method: PaymentMethod.local_transfer,
          transferReference: "TRX-123",
        }),
      }),
    );
  });

  it("prevents payout edits after approval", async () => {
    prisma.payouts.findUnique.mockResolvedValueOnce({ ...pending, status: PayoutStatus.approved });

    await expect(
      service.addLine(
        "payout-1",
        { kind: PayoutLineKind.days_worked, amount: 100 },
        finance,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("restricts payout creation to Finance and Super admin", async () => {
    await expect(
      service.create(
        { talentId: "talent-1", periodMonth: "2020-01-01", currency: "EUR" },
        { ...finance, role: UserRole.sales },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("restricts talent payout reads to their own talent scope", async () => {
    await expect(
      service.findById("payout-1", {
        id: "talent-user",
        email: "talent@example.com",
        role: UserRole.talent,
        talentId: "talent-2",
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
