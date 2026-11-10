import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ContractType, Prisma, SignatureStatus, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FilesService } from "../files/files.service";
import { FileCategory } from "../files/dto/upload-file.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateContractDto } from "./dto/create-contract.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";
import { CreateSignatoryDto } from "./dto/create-signatory.dto";
import { UpdateSignatureStatusDto } from "./dto/update-signature-status.dto";
import { QueryContractsDto } from "./dto/query-contracts.dto";
import { ContractResponseDto } from "./dto/contract-response.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.finance,
  UserRole.sales,
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.account_manager,
];

@Injectable()
export class ContractsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly filesService: FilesService,
  ) {}

  private assertCanEdit(user: AuthenticatedUser): void {
    if (!([UserRole.super_admin, UserRole.finance] as UserRole[]).includes(user.role)) {
      throw new ForbiddenException("Only Finance or Super admin can modify contracts");
    }
  }

  private async assertRelationExists(dto: {
    placementId?: string;
    companyId?: string;
    talentId?: string;
  }): Promise<void> {
    if (!dto.placementId && !dto.companyId && !dto.talentId) {
      throw new BadRequestException("A contract must be linked to a placement, company, or talent");
    }
    if (dto.placementId && !(await this.prisma.placements.findUnique({ where: { id: dto.placementId } }))) {
      throw new NotFoundException(`Placement ${dto.placementId} not found`);
    }
    if (dto.companyId && !(await this.prisma.companies.findUnique({ where: { id: dto.companyId } }))) {
      throw new NotFoundException(`Company ${dto.companyId} not found`);
    }
    if (dto.talentId && !(await this.prisma.talents.findUnique({ where: { id: dto.talentId } }))) {
      throw new NotFoundException(`Talent ${dto.talentId} not found`);
    }
  }

  async create(dto: CreateContractDto, user: AuthenticatedUser): Promise<ContractResponseDto> {
    this.assertCanEdit(user);
    await this.assertRelationExists(dto);
    const contract = await this.prisma.withUserContext(user, (tx) =>
      tx.contracts.create({
        data: {
          type: dto.type,
          title: dto.title,
          placementId: dto.placementId,
          companyId: dto.companyId,
          talentId: dto.talentId,
          legalEntityId: dto.legalEntityId,
          parentContractId: dto.parentContractId,
          effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          nonSolicitMonths: dto.nonSolicitMonths ?? 12,
          createdBy: user.id,
        },
      }),
    );
    return this.findById(contract.id, user);
  }

  async findAll(query: QueryContractsDto, user: AuthenticatedUser) {
    const where: Prisma.ContractsWhereInput = {};
    if (!STAFF_ROLES.includes(user.role)) {
      if (user.companyId) where.companyId = user.companyId;
      else if (user.talentId) where.talentId = user.talentId;
      else throw new ForbiddenException("User has no contract scope");
    } else {
      if (query.companyId) where.companyId = query.companyId;
      if (query.placementId) where.placementId = query.placementId;
    }
    if (query.type) where.type = query.type;
    if (query.signatureStatus) where.signatureStatus = query.signatureStatus;
    if (query.search) where.title = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    const skip = (query.page - 1) * query.pageSize;
    const [total, contracts] = await Promise.all([
      this.prisma.contracts.count({ where }),
      this.prisma.contracts.findMany({ where, skip, take: query.pageSize, orderBy: { createdAt: "desc" } }),
    ]);
    return { data: await Promise.all(contracts.map((contract) => this.mapResponse(contract))), meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async findById(id: string, user: AuthenticatedUser): Promise<ContractResponseDto> {
    const contract = await this.prisma.contracts.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException(`Contract ${id} not found`);
    if (!STAFF_ROLES.includes(user.role) && contract.companyId !== user.companyId && contract.talentId !== user.talentId) {
      throw new ForbiddenException("Access to this contract is denied");
    }
    return this.mapResponse(contract);
  }

  async update(id: string, dto: UpdateContractDto, user: AuthenticatedUser): Promise<ContractResponseDto> {
    this.assertCanEdit(user);
    const existing = await this.getRaw(id);
    await this.assertRelationExists({
      placementId: dto.placementId ?? existing.placementId ?? undefined,
      companyId: dto.companyId ?? existing.companyId ?? undefined,
      talentId: dto.talentId ?? existing.talentId ?? undefined,
    });
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.contracts.update({
        where: { id },
        data: {
          ...(dto.type !== undefined && { type: dto.type }),
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.placementId !== undefined && { placementId: dto.placementId }),
          ...(dto.companyId !== undefined && { companyId: dto.companyId }),
          ...(dto.talentId !== undefined && { talentId: dto.talentId }),
          ...(dto.legalEntityId !== undefined && { legalEntityId: dto.legalEntityId }),
          ...(dto.parentContractId !== undefined && { parentContractId: dto.parentContractId }),
          ...(dto.effectiveDate !== undefined && { effectiveDate: new Date(dto.effectiveDate) }),
          ...(dto.expiryDate !== undefined && { expiryDate: new Date(dto.expiryDate) }),
          ...(dto.nonSolicitMonths !== undefined && { nonSolicitMonths: dto.nonSolicitMonths }),
          updatedAt: new Date(),
        },
      }),
    );
    return this.mapResponse(updated);
  }

  async attachFile(id: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }, signed: boolean, user: AuthenticatedUser) {
    this.assertCanEdit(user);
    await this.getRaw(id);
    const uploaded = await this.filesService.uploadFile(file, FileCategory.CONTRACT, user);
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.contracts.update({
        where: { id },
        data: signed ? { signedFileId: uploaded.id } : { fileId: uploaded.id },
      }),
    );
    return this.mapResponse(updated);
  }

  async addSignatory(id: string, dto: CreateSignatoryDto, user: AuthenticatedUser) {
    this.assertCanEdit(user);
    await this.getRaw(id);
    return this.prisma.withUserContext(user, (tx) =>
      tx.contractSignatories.create({
        data: { contractId: id, party: dto.party, userId: dto.userId, name: dto.name, email: dto.email, signingOrder: dto.signingOrder ?? 1 },
      }),
    );
  }

  async updateSignatureStatus(id: string, dto: UpdateSignatureStatusDto, user: AuthenticatedUser): Promise<ContractResponseDto> {
    this.assertCanEdit(user);
    const existing = await this.getRaw(id);
    if (dto.status === SignatureStatus.signed && !existing.signedFileId) {
      throw new BadRequestException("A signed file is required before marking the contract signed");
    }
    const updated = await this.prisma.withUserContext(user, async (tx) => {
      const contract = await tx.contracts.update({
        where: { id },
        data: {
          signatureStatus: dto.status,
          ...(dto.status === SignatureStatus.sent && { sentAt: new Date() }),
          ...(dto.status === SignatureStatus.signed && { fullySignedAt: new Date() }),
        },
      });
      if (dto.status === SignatureStatus.signed && contract.placementId) {
        await tx.placementOnboardingItems.updateMany({
          where: {
            placementId: contract.placementId,
            code: { in: [contract.type === ContractType.talent_freelance_agreement ? "talent_contract" : "client_contract"] },
          },
          data: { isDone: true, doneAt: new Date(), doneBy: user.id },
        });
      }
      return contract;
    });
    return this.mapResponse(updated);
  }

  private async getRaw(id: string) {
    const contract = await this.prisma.contracts.findUnique({ where: { id } });
    if (!contract) throw new NotFoundException(`Contract ${id} not found`);
    return contract;
  }

  private async mapResponse(contract: any): Promise<ContractResponseDto> {
    const signatories = await this.prisma.contractSignatories.findMany({
      where: { contractId: contract.id },
      orderBy: { signingOrder: "asc" },
    });
    return {
      id: contract.id,
      type: contract.type,
      title: contract.title,
      placementId: contract.placementId,
      companyId: contract.companyId,
      talentId: contract.talentId,
      legalEntityId: contract.legalEntityId,
      fileId: contract.fileId,
      signedFileId: contract.signedFileId,
      signatureStatus: contract.signatureStatus,
      effectiveDate: contract.effectiveDate?.toISOString().split("T")[0] ?? null,
      expiryDate: contract.expiryDate?.toISOString().split("T")[0] ?? null,
      nonSolicitMonths: contract.nonSolicitMonths,
      signatories: signatories.map((item) => ({
        id: item.id,
        party: item.party,
        userId: item.userId,
        name: item.name,
        email: item.email,
        signingOrder: item.signingOrder,
        signedAt: item.signedAt?.toISOString() ?? null,
        declinedAt: item.declinedAt?.toISOString() ?? null,
      })),
      createdAt: contract.createdAt.toISOString(),
      updatedAt: contract.updatedAt.toISOString(),
    };
  }

  // ==========================================
  // TALENT PORTAL CONTRACT METHODS
  // ==========================================

  async getTalentContracts(currentUser: AuthenticatedUser) {
    let talentId = currentUser?.talentId;
    if (!talentId && currentUser?.id) {
      const talent = await this.prisma.talents.findFirst({
        where: { userId: currentUser.id },
        select: { id: true },
      });
      talentId = talent?.id;
    }
    if (!talentId && currentUser?.role === UserRole.super_admin) {
      const firstTalent = await this.prisma.talents.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      });
      talentId = firstTalent?.id;
    }
    if (!talentId) {
      throw new ForbiddenException("No talent profile found");
    }

    const placements = await this.prisma.placements.findMany({
      where: { talentId },
      select: { id: true, companyId: true },
    });
    const placementIds = placements.map((p) => p.id);

    const contracts = await this.prisma.contracts.findMany({
      where: {
        OR: [
          { talentId },
          { placementId: { in: placementIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return Promise.all(
      contracts.map(async (c) => {
        let companyName = "Coders Hub SAS";
        if (c.companyId) {
          const comp = await this.prisma.companies.findUnique({
            where: { id: c.companyId },
            select: { name: true },
          });
          if (comp?.name) companyName = comp.name;
        }

        const signatories = await this.prisma.contractSignatories.findMany({
          where: { contractId: c.id },
          orderBy: { signingOrder: "asc" },
        });

        return {
          id: c.id,
          title: c.title,
          type: c.type,
          companyName,
          status: c.signatureStatus,
          effectiveDate: c.effectiveDate?.toISOString().split("T")[0] ?? null,
          expiryDate: c.expiryDate?.toISOString().split("T")[0] ?? null,
          signedFileId: c.signedFileId,
          fileId: c.fileId,
          signatories: signatories.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            signedAt: s.signedAt?.toISOString() ?? null,
          })),
          createdAt: c.createdAt.toISOString(),
        };
      }),
    );
  }

  async getTalentContractById(id: string, currentUser: AuthenticatedUser) {
    const contracts = await this.getTalentContracts(currentUser);
    const contract = contracts.find((c) => c.id === id);
    if (!contract) {
      throw new NotFoundException("Contract not found or access denied");
    }
    return contract;
  }
}
