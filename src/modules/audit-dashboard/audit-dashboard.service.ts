import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { QueryAuditDto } from "./dto/query-audit.dto";
import { QueryStatusHistoryDto } from "./dto/query-status-history.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.finance,
  UserRole.super_admin,
];

@Injectable()
export class AuditDashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAudit(query: QueryAuditDto, user: AuthenticatedUser) {
    this.assertStaff(user);
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.action) where.action = query.action;
    if (query.userId) where.userId = query.userId;
    const skip = (query.page - 1) * query.pageSize;
    const [total, data] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      data: data.map((entry) => ({ ...entry, id: entry.id.toString() })),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async listStatusHistory(query: QueryStatusHistoryDto, user: AuthenticatedUser) {
    this.assertStaff(user);
    const where: Prisma.StatusHistoryWhereInput = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.changedBy) where.changedBy = query.changedBy;
    const skip = (query.page - 1) * query.pageSize;
    const [total, data] = await Promise.all([
      this.prisma.statusHistory.count({ where }),
      this.prisma.statusHistory.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { changedAt: "desc" },
      }),
    ]);
    return {
      data: data.map((entry) => ({ ...entry, id: entry.id.toString() })),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async getDashboard(user: AuthenticatedUser) {
    this.assertStaff(user);
    type MrrRow = {
      currency: string;
      active_placements: bigint | number;
      mrr: Prisma.Decimal | string | null;
      monthly_gross_margin: Prisma.Decimal | string | null;
      gross_margin_pct: Prisma.Decimal | string | null;
    };
    type AgingRow = {
      id: string;
      number: string | null;
      company_id: string;
      currency: string;
      total: Prisma.Decimal | string;
      balance_due: Prisma.Decimal | string;
      due_date: Date;
      days_overdue: number;
      bucket: string;
    };
    type EconomicsRow = Record<string, unknown> & {
      margin_amount?: Prisma.Decimal | string | null;
      contribution_margin?: Prisma.Decimal | string | null;
    };
    const [
      mrr,
      invoiceAging,
      placementEconomics,
      payoutsDue,
      openRequests,
      activePlacementsCount,
      trialPlacements,
      riskFlags,
    ] = await Promise.all([
      this.prisma.$queryRaw<MrrRow[]>(Prisma.sql`SELECT * FROM v_kpi_mrr`),
      this.prisma.$queryRaw<AgingRow[]>(Prisma.sql`SELECT * FROM v_invoice_aging ORDER BY days_overdue DESC`),
      this.prisma.$queryRaw<EconomicsRow[]>(Prisma.sql`SELECT * FROM v_placement_economics`),
      this.prisma.payouts.count({ where: { status: { in: ["pending", "approved"] } } }),
      this.prisma.talentRequests.count({
        where: { status: { in: ["open", "sourcing", "shortlist_sent", "interviewing", "proposal_sent"] } },
      }),
      this.prisma.placements.count({ where: { status: "active" } }),
      this.prisma.placements.count({ where: { status: "in_trial" } }),
      this.prisma.riskFlags.count({ where: { resolvedAt: null } }),
    ]);
    const decimal = (value: Prisma.Decimal | string | null | undefined) =>
      new Prisma.Decimal(value ?? 0).toFixed(2);
    const mrrActivePlacements = mrr.reduce((sum, row) => sum + Number(row.active_placements), 0);
    return {
      mrr,
      invoiceAging,
      placementEconomics,
      payoutsDue,
      openRequests,
      activePlacements: mrrActivePlacements > 0 ? mrrActivePlacements : activePlacementsCount,
      trialPlacements,
      riskFlags,
      summary: {
        activePlacements: mrrActivePlacements > 0 ? mrrActivePlacements : activePlacementsCount,
        mrr: mrr.reduce((sum, row) => sum.plus(row.mrr ?? 0), new Prisma.Decimal(0)).toFixed(2),
        monthlyGrossMargin: mrr
          .reduce((sum, row) => sum.plus(row.monthly_gross_margin ?? 0), new Prisma.Decimal(0))
          .toFixed(2),
        contributionMargin: placementEconomics
          .reduce((sum, row) => sum.plus(row.contribution_margin ?? 0), new Prisma.Decimal(0))
          .toFixed(2),
        overdueInvoices: invoiceAging.filter((row) => row.days_overdue > 0).length,
        payoutsDue,
        openRequests,
        trialPlacements,
        riskFlags,
      },
    };
  }

  private assertStaff(user: AuthenticatedUser): void {
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException("Audit and dashboard access is denied");
    }
  }
}
