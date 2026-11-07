import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { PayoutLineKind, PayoutStatus, Prisma, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { FilesService } from "../files/files.service";
import { FileCategory } from "../files/dto/upload-file.dto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreatePayoutDto } from "./dto/create-payout.dto";
import { CreatePayoutLineDto } from "./dto/create-payout-line.dto";
import { MarkPaidDto } from "./dto/mark-paid.dto";
import { QueryPayoutsDto } from "./dto/query-payouts.dto";
import { PayoutResponseDto } from "./dto/payout-response.dto";

const FINANCE_ROLES: UserRole[] = [UserRole.finance, UserRole.super_admin];
const STAFF_ROLES: UserRole[] = [
  UserRole.finance,
  UserRole.super_admin,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.recruiter_lead,
  UserRole.recruiter,
];

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  private assertFinance(user: AuthenticatedUser): void {
    if (!FINANCE_ROLES.includes(user.role)) {
      throw new ForbiddenException("Only Finance or Super admin can modify payouts");
    }
  }

  private assertPending(status: PayoutStatus): void {
    if (status !== PayoutStatus.pending) {
      throw new UnprocessableEntityException("Approved or paid payouts cannot be edited");
    }
  }

  private async getRaw(id: string) {
    const payout = await this.prisma.payouts.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException(`Payout ${id} not found`);
    return payout;
  }

  async create(dto: CreatePayoutDto, user: AuthenticatedUser): Promise<PayoutResponseDto> {
    this.assertFinance(user);
    const periodMonth = new Date(dto.periodMonth);
    const previousMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 1, 1));
    if (
      periodMonth.getUTCFullYear() !== previousMonth.getUTCFullYear() ||
      periodMonth.getUTCMonth() !== previousMonth.getUTCMonth() ||
      periodMonth.getUTCDate() !== 1
    ) {
      throw new UnprocessableEntityException({
        code: "FR-PAY-01",
        message: "Payout period must be the immediately previous calendar month (FR-PAY-01)",
      });
    }
    const talent = await this.prisma.talents.findUnique({ where: { id: dto.talentId } });
    if (!talent) throw new NotFoundException(`Talent ${dto.talentId} not found`);
    const payout = await this.prisma.withUserContext(user, (tx) =>
      tx.payouts.create({
        data: {
          talentId: dto.talentId,
          periodMonth,
          legalEntityId: dto.legalEntityId,
          currency: dto.currency.toUpperCase(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          createdBy: user.id,
        },
      }),
    );
    return this.findById(payout.id, user);
  }

  async findAll(query: QueryPayoutsDto, user: AuthenticatedUser) {
    const where: Prisma.PayoutsWhereInput = {};
    if (user.role === UserRole.talent) {
      if (!user.talentId) throw new ForbiddenException("Talent user has no talent scope");
      where.talentId = user.talentId;
    } else if (STAFF_ROLES.includes(user.role)) {
      if (query.talentId) where.talentId = query.talentId;
    } else {
      throw new ForbiddenException("Access to payouts is denied");
    }
    if (query.status) where.status = query.status;
    if (query.currency) where.currency = query.currency.toUpperCase();
    const skip = (query.page - 1) * query.pageSize;
    const [total, payouts] = await Promise.all([
      this.prisma.payouts.count({ where }),
      this.prisma.payouts.findMany({ where, skip, take: query.pageSize, orderBy: { periodMonth: "desc" } }),
    ]);
    return {
      data: await Promise.all(payouts.map((payout) => this.mapResponse(payout))),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findById(id: string, user: AuthenticatedUser): Promise<PayoutResponseDto> {
    const payout = await this.getRaw(id);
    if (user.role === UserRole.talent && payout.talentId !== user.talentId) {
      throw new ForbiddenException("Access to this payout is denied");
    }
    if (!STAFF_ROLES.includes(user.role) && user.role !== UserRole.talent) {
      throw new ForbiddenException("Access to payouts is denied");
    }
    return this.mapResponse(payout);
  }

  async addLine(id: string, dto: CreatePayoutLineDto, user: AuthenticatedUser): Promise<PayoutResponseDto> {
    this.assertFinance(user);
    const payout = await this.getRaw(id);
    this.assertPending(payout.status);
    if (dto.placementId) {
      const placement = await this.prisma.placements.findUnique({ where: { id: dto.placementId } });
      if (!placement || placement.talentId !== payout.talentId) {
        throw new BadRequestException("Placement does not belong to the payout talent");
      }
    }
    await this.prisma.withUserContext(user, async (tx) => {
      await tx.payoutLines.create({
        data: {
          payoutId: id,
          placementId: dto.placementId,
          kind: dto.kind,
          description: dto.description,
          days: dto.days === undefined ? null : new Prisma.Decimal(dto.days),
          dailyRate: dto.dailyRate === undefined ? null : new Prisma.Decimal(dto.dailyRate),
          amount: new Prisma.Decimal(dto.amount),
        },
      });
      await this.recalculate(tx, id);
    });
    return this.findById(id, user);
  }

  async approve(id: string, user: AuthenticatedUser): Promise<PayoutResponseDto> {
    this.assertFinance(user);
    const payout = await this.getRaw(id);
    this.assertPending(payout.status);
    if (new Prisma.Decimal(payout.netAmount).lessThan(0)) {
      throw new BadRequestException("Payout net amount cannot be negative");
    }
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.payouts.update({
        where: { id },
        data: { status: PayoutStatus.approved, approvedBy: user.id, approvedAt: new Date() },
      }),
    );
    return this.mapResponse(updated);
  }

  async markPaid(id: string, dto: MarkPaidDto, user: AuthenticatedUser): Promise<PayoutResponseDto> {
    this.assertFinance(user);
    const payout = await this.getRaw(id);
    if (payout.status !== PayoutStatus.approved) {
      throw new BadRequestException("Only approved payouts can be marked paid");
    }
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.payouts.update({
        where: { id },
        data: {
          status: PayoutStatus.paid,
          paidCurrency: dto.paidCurrency.toUpperCase(),
          paidAmount: new Prisma.Decimal(dto.paidAmount),
          fxRate: new Prisma.Decimal(dto.fxRate),
          fees: new Prisma.Decimal(dto.fees ?? 0),
          method: dto.method,
          transferReference: dto.transferReference,
          paidAt: new Date(),
        },
      }),
    );
    return this.mapResponse(updated);
  }

  async attachStatement(
    id: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    user: AuthenticatedUser,
  ): Promise<PayoutResponseDto> {
    this.assertFinance(user);
    await this.getRaw(id);
    const uploaded = await this.filesService.uploadFile(file, FileCategory.DOCUMENT, user);
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.payouts.update({ where: { id }, data: { statementFileId: uploaded.id } }),
    );
    return this.mapResponse(updated);
  }

  private async recalculate(tx: any, id: string): Promise<void> {
    const lines = await tx.payoutLines.findMany({ where: { payoutId: id } });
    const grossKinds = new Set([PayoutLineKind.days_worked, PayoutLineKind.trial_days, PayoutLineKind.paid_leave]);
    const gross = lines
      .filter((line: any) => grossKinds.has(line.kind))
      .reduce((sum: Prisma.Decimal, line: any) => sum.plus(line.amount), new Prisma.Decimal(0));
    const adjustments = lines
      .filter((line: any) => !grossKinds.has(line.kind))
      .reduce((sum: Prisma.Decimal, line: any) => sum.plus(line.amount), new Prisma.Decimal(0));
    await tx.payouts.update({
      where: { id },
      data: {
        grossAmount: gross,
        adjustmentsTotal: adjustments,
        netAmount: gross.plus(adjustments),
      },
    });
  }

  private async mapResponse(payout: any): Promise<PayoutResponseDto> {
    const lines = await this.prisma.payoutLines.findMany({
      where: { payoutId: payout.id },
      orderBy: { sortOrder: "asc" },
    });
    return {
      id: payout.id,
      talentId: payout.talentId,
      legalEntityId: payout.legalEntityId,
      periodMonth: payout.periodMonth.toISOString().split("T")[0],
      status: payout.status,
      currency: payout.currency,
      grossAmount: new Prisma.Decimal(payout.grossAmount).toFixed(2),
      adjustmentsTotal: new Prisma.Decimal(payout.adjustmentsTotal).toFixed(2),
      netAmount: new Prisma.Decimal(payout.netAmount).toFixed(2),
      paidCurrency: payout.paidCurrency,
      fxRate: payout.fxRate ? new Prisma.Decimal(payout.fxRate).toFixed(8) : null,
      paidAmount: payout.paidAmount ? new Prisma.Decimal(payout.paidAmount).toFixed(2) : null,
      fees: new Prisma.Decimal(payout.fees).toFixed(2),
      method: payout.method,
      transferReference: payout.transferReference,
      lines: lines.map((line: any) => ({
        id: line.id,
        kind: line.kind,
        placementId: line.placementId,
        description: line.description,
        days: line.days ? new Prisma.Decimal(line.days).toFixed(2) : null,
        dailyRate: line.dailyRate ? new Prisma.Decimal(line.dailyRate).toFixed(2) : null,
        amount: new Prisma.Decimal(line.amount).toFixed(2),
      })),
      createdAt: payout.createdAt.toISOString(),
      updatedAt: payout.updatedAt.toISOString(),
    };
  }
}
