import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { ContractType, SignatureStatus, UserRole } from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ContractsService } from "./contracts.service";

const resolved = <T>(value: T) => (jest.fn() as any).mockResolvedValue(value);

describe("ContractsService", () => {
  let service: ContractsService;
  let prisma: any;
  let filesService: any;

  const financeUser: AuthenticatedUser = {
    id: "finance-1",
    email: "finance@example.com",
    role: UserRole.finance,
  };

  beforeEach(() => {
    prisma = {
      placements: { findUnique: resolved({ id: "placement-1" }) },
      companies: { findUnique: resolved({ id: "company-1" }) },
      talents: { findUnique: resolved({ id: "talent-1" }) },
      contracts: {
        create: resolved({
          id: "contract-1",
          type: ContractType.client_order_form,
          title: "Order form",
          companyId: "company-1",
          signatureStatus: SignatureStatus.draft,
          nonSolicitMonths: 12,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findUnique: resolved({
          id: "contract-1",
          type: ContractType.client_order_form,
          title: "Order form",
          companyId: "company-1",
          signatureStatus: SignatureStatus.draft,
          signedFileId: "signed-file-1",
          nonSolicitMonths: 12,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: resolved({
          id: "contract-1",
          type: ContractType.client_order_form,
          title: "Order form",
          companyId: "company-1",
          signatureStatus: SignatureStatus.signed,
          signedFileId: "signed-file-1",
          nonSolicitMonths: 12,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      contractSignatories: {
        findMany: resolved([]),
        create: jest.fn(),
      },
      placementOnboardingItems: { updateMany: jest.fn<any>() },
      withUserContext: jest.fn<any>().mockImplementation((_user: AuthenticatedUser, callback: (tx: any) => unknown) => callback(prisma)),
    };
    filesService = {
      uploadFile: resolved({ id: "file-1" }),
    };
    service = new ContractsService(prisma, filesService);
  });

  it("creates a contract linked to a company", async () => {
    await service.create(
      { type: ContractType.client_order_form, title: "Order form", companyId: "company-1" },
      financeUser,
    );

    expect(prisma.contracts.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: "company-1", createdBy: financeUser.id }),
      }),
    );
  });

  it("rejects contract creation without an owner relation", async () => {
    await expect(
      service.create({ type: ContractType.client_order_form, title: "Order form" }, financeUser),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects contract edits from sales users", async () => {
    await expect(
      service.create(
        { type: ContractType.client_order_form, title: "Order form", companyId: "company-1" },
        { ...financeUser, role: UserRole.sales },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it("requires a signed file before marking a contract signed", async () => {
    (prisma.contracts.findUnique as any).mockResolvedValueOnce({
      id: "contract-1",
      type: ContractType.client_order_form,
      title: "Order form",
      companyId: "company-1",
      signatureStatus: SignatureStatus.draft,
      signedFileId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.updateSignatureStatus(
        "contract-1",
        { status: SignatureStatus.signed },
        financeUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
