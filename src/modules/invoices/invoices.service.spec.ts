import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ForbiddenException, UnprocessableEntityException } from "@nestjs/common";
import { InvoiceKind, InvoiceStatus, PaymentMethod, Prisma, UserRole } from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { InvoicesService } from "./invoices.service";

const resolved = <T>(value: T) => (jest.fn() as any).mockResolvedValue(value);

describe("InvoicesService", () => {
  let service: InvoicesService;
  let prisma: any;
  let filesService: any;
  const finance: AuthenticatedUser = {
    id: "finance-1",
    email: "finance@example.com",
    role: UserRole.finance,
  };

  beforeEach(() => {
    prisma = {
      companies: { findUnique: resolved({ id: "company-1" }) },
      legalEntities: { findUnique: resolved({ id: "entity-1" }) },
      invoices: {
        create: resolved({
          id: "invoice-1",
          kind: InvoiceKind.invoice,
          companyId: "company-1",
          legalEntityId: "entity-1",
          status: InvoiceStatus.draft,
          currency: "EUR",
          subtotal: "0",
          discountTotal: "0",
          vatRate: "0",
          vatAmount: "0",
          total: "0",
          amountPaid: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findUnique: resolved({
          id: "invoice-1",
          kind: InvoiceKind.invoice,
          companyId: "company-1",
          legalEntityId: "entity-1",
          status: InvoiceStatus.draft,
          currency: "EUR",
          subtotal: "0",
          discountTotal: "0",
          vatRate: "0",
          vatAmount: "0",
          total: "0",
          amountPaid: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: resolved({
          id: "invoice-1",
          kind: InvoiceKind.invoice,
          companyId: "company-1",
          legalEntityId: "entity-1",
          status: InvoiceStatus.issued,
          currency: "EUR",
          subtotal: "100",
          discountTotal: "0",
          vatRate: "0",
          vatAmount: "0",
          total: "100",
          amountPaid: "0",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      invoiceLines: {
        create: jest.fn<any>(),
        findMany: resolved([]),
      },
      payments: {
        create: jest.fn<any>(),
        findMany: resolved([]),
      },
      invoiceNumberSequences: {
        upsert: resolved({ lastNumber: 7 }),
      },
      withUserContext: jest.fn<any>().mockImplementation(
        (_user: AuthenticatedUser, callback: (tx: any) => unknown) => callback(prisma),
      ),
    };
    filesService = { uploadFile: resolved({ id: "file-1" }) };
    service = new InvoicesService(prisma, filesService);
  });

  it("FR-BILL-01: calculates invoice line amount with Decimal arithmetic", async () => {
    await service.addLine(
      "invoice-1",
      {
        kind: "dedicated_fee" as any,
        description: "Monthly placement",
        quantity: 1,
        unitPrice: 2000,
        discountPct: 10,
      },
      finance,
    );

    expect(prisma.invoiceLines.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: new Prisma.Decimal("1800") }),
      }),
    );
  });

  it("FR-BILL-02: prevents updates after issuing an invoice", async () => {
    prisma.invoices.findUnique.mockResolvedValueOnce({
      id: "invoice-1",
      status: InvoiceStatus.issued,
      companyId: "company-1",
    });

    await expect(
      service.update("invoice-1", { notes: "changed" }, finance),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("FR-BILL-02: assigns a sequential legal-entity invoice number", async () => {
    prisma.invoices.findUnique.mockResolvedValueOnce({
      id: "invoice-1",
      kind: InvoiceKind.invoice,
      legalEntityId: "entity-1",
      status: InvoiceStatus.draft,
    });
    prisma.invoiceLines.findMany.mockResolvedValueOnce([{ id: "line-1" }]);

    await service.issue("invoice-1", finance);

    expect(prisma.invoices.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sequenceNumber: 7, number: expect.stringMatching(/^INV-/) }),
      }),
    );
  });

  it("FR-BILL-03: rejects payments that exceed the invoice total", async () => {
    prisma.invoices.findUnique.mockResolvedValueOnce({
      id: "invoice-1",
      status: InvoiceStatus.issued,
      total: "100",
      amountPaid: "90",
    });

    await expect(
      service.recordPayment(
        "invoice-1",
        {
          receivedOn: "2026-11-03",
          amount: 11,
          currency: "EUR",
          method: PaymentMethod.swift,
        },
        finance,
      ),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("denies invoice modification to Sales", async () => {
    await expect(
      service.create(
        {
          kind: InvoiceKind.invoice,
          companyId: "company-1",
          legalEntityId: "entity-1",
          currency: "EUR",
        },
        { ...finance, role: UserRole.sales },
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
