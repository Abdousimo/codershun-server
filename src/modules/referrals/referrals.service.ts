import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  Prisma,
  ReferralStatus,
  RewardStatus,
  UserRole,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateReferralDto } from "./dto/create-referral.dto";
import { CreateRewardDto } from "./dto/create-reward.dto";
import { MarkRewardPayableDto } from "./dto/mark-reward-payable.dto";
import { PayRewardDto } from "./dto/pay-reward.dto";
import { QueryReferralsDto } from "./dto/query-referrals.dto";
import { ReferralResponseDto } from "./dto/referral-response.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.super_admin,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.recruiter_lead,
  UserRole.recruiter,
  UserRole.finance,
];
const FINANCE_ROLES: UserRole[] = [UserRole.super_admin, UserRole.finance];

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertStaff(user: AuthenticatedUser): void {
    if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException("Access to referrals is denied");
    }
  }

  private assertFinance(user: AuthenticatedUser): void {
    if (!FINANCE_ROLES.includes(user.role)) {
      throw new ForbiddenException("Only Finance or Super admin can manage referral rewards");
    }
  }

  private async getReferral(id: string) {
    const referral = await this.prisma.referrals.findUnique({ where: { id } });
    if (!referral) throw new NotFoundException(`Referral ${id} not found`);
    return referral;
  }

  private async getReward(id: string) {
    const reward = await this.prisma.referralRewards.findUnique({ where: { id } });
    if (!reward) throw new NotFoundException(`Referral reward ${id} not found`);
    return reward;
  }

  async create(dto: CreateReferralDto, user: AuthenticatedUser): Promise<ReferralResponseDto> {
    this.assertStaff(user);
    const referrer = await this.prisma.referrers.findUnique({ where: { id: dto.referrerId } });
    if (!referrer || !referrer.isActive) {
      throw new BadRequestException("Referrer is not active or does not exist");
    }
    if (dto.companyId && referrer.companyId === dto.companyId) {
      throw new UnprocessableEntityException({
        code: "FR-REF-01",
        message: "A referrer cannot refer their own company (FR-REF-01)",
      });
    }
    const existing = await this.prisma.referrals.findFirst({
      where: {
        referrerId: dto.referrerId,
        OR: [
          ...(dto.companyId ? [{ companyId: dto.companyId }] : []),
          ...(dto.leadId ? [{ leadId: dto.leadId }] : []),
        ],
        status: { not: ReferralStatus.lost },
      },
    });
    if (existing) throw new BadRequestException("This company or lead is already attributed to the referrer");

    const attributedAt = new Date();
    const attributionExpiresAt = new Date(attributedAt);
    attributionExpiresAt.setUTCDate(attributionExpiresAt.getUTCDate() + 90);
    const referral = await this.prisma.withUserContext(user, (tx) =>
      tx.referrals.create({
        data: {
          referrerId: dto.referrerId,
          companyId: dto.companyId,
          leadId: dto.leadId,
          referredTalentId: dto.referredTalentId,
          referralKind: dto.referredTalentId ? "talent" : "client",
          introCompanyName: dto.introCompanyName,
          introContactName: dto.introContactName,
          introContactEmail: dto.introContactEmail,
          introNeed: dto.introNeed,
          attributedAt,
          attributionExpiresAt,
        },
      }),
    );
    return this.findById(referral.id, user);
  }

  async findAll(query: QueryReferralsDto, user: AuthenticatedUser) {
    this.assertStaff(user);
    const where: Prisma.ReferralsWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.referrerId) where.referrerId = query.referrerId;
    if (query.rewardStatus) {
      const rewards = await this.prisma.referralRewards.findMany({
        where: { status: query.rewardStatus },
        select: { referralId: true },
      });
      where.id = { in: rewards.map((reward: { referralId: string }) => reward.referralId) };
    }
    const skip = (query.page - 1) * query.pageSize;
    const [total, referrals] = await Promise.all([
      this.prisma.referrals.count({ where }),
      this.prisma.referrals.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      data: await Promise.all(referrals.map((referral) => this.mapResponse(referral))),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  async findById(id: string, user: AuthenticatedUser): Promise<ReferralResponseDto> {
    this.assertStaff(user);
    return this.mapResponse(await this.getReferral(id));
  }

  async markContacted(id: string, user: AuthenticatedUser): Promise<ReferralResponseDto> {
    this.assertStaff(user);
    const referral = await this.getReferral(id);
    if (referral.status !== ReferralStatus.submitted) {
      throw new BadRequestException("Only submitted referrals can be marked contacted");
    }
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.referrals.update({ where: { id }, data: { status: ReferralStatus.contacted } }),
    );
    return this.mapResponse(updated);
  }

  async markWon(id: string, user: AuthenticatedUser): Promise<ReferralResponseDto> {
    this.assertStaff(user);
    const referral = await this.getReferral(id);
    if (referral.status !== ReferralStatus.contacted && referral.status !== ReferralStatus.submitted) {
      throw new BadRequestException("Only active referrals can be marked won");
    }
    if (new Date() > referral.attributionExpiresAt) {
      throw new BadRequestException("Referral attribution has expired");
    }
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.referrals.update({ where: { id }, data: { status: ReferralStatus.won } }),
    );
    return this.mapResponse(updated);
  }

  async markLost(id: string, user: AuthenticatedUser): Promise<ReferralResponseDto> {
    this.assertStaff(user);
    const referral = await this.getReferral(id);
    if (referral.status === ReferralStatus.lost) {
      throw new BadRequestException("Referral is already lost");
    }
    const updated = await this.prisma.withUserContext(user, (tx) =>
      tx.referrals.update({ where: { id }, data: { status: ReferralStatus.lost } }),
    );
    return this.mapResponse(updated);
  }

  async createReward(
    id: string,
    dto: CreateRewardDto,
    user: AuthenticatedUser,
  ): Promise<ReferralResponseDto> {
    this.assertStaff(user);
    const referral = await this.getReferral(id);
    if (referral.status !== ReferralStatus.won) {
      throw new BadRequestException("Rewards can only be created for Won referrals");
    }
    const rule = dto.rewardRuleId
      ? await this.prisma.referralRewardRules.findUnique({ where: { id: dto.rewardRuleId } })
      : await this.prisma.referralRewardRules.findFirst({
          where: { rewardType: dto.rewardType, isActive: true },
          orderBy: { baseAmount: "asc" },
        });
    if (!rule && !dto.amount) throw new BadRequestException("An active reward rule or explicit amount is required");
    const reward = await this.prisma.withUserContext(user, (tx) =>
      tx.referralRewards.create({
        data: {
          referralId: id,
          rewardRuleId: rule?.id,
          rewardType: dto.rewardType,
          amount: new Prisma.Decimal(dto.amount ?? rule!.baseAmount),
          currency: (dto.currency ?? rule?.currency ?? "EUR").toUpperCase(),
        },
      }),
    );
    return this.findById(id, user);
  }

  async markRewardPayable(
    rewardId: string,
    dto: MarkRewardPayableDto,
    user: AuthenticatedUser,
  ): Promise<ReferralResponseDto> {
    this.assertFinance(user);
    const reward = await this.getReward(rewardId);
    if (reward.status !== RewardStatus.pending) {
      throw new BadRequestException("Only pending rewards can become payable");
    }
    const rule = reward.rewardRuleId
      ? await this.prisma.referralRewardRules.findUnique({ where: { id: reward.rewardRuleId } })
      : null;
    const requiredInvoices = rule?.paidInvoicesRequired ?? 2;
    if (dto.paidInvoicesCount < requiredInvoices || !dto.trialPassed) {
      throw new BadRequestException("Reward requires the configured paid invoices count and a passed trial");
    }
    await this.prisma.withUserContext(user, (tx) =>
      tx.referralRewards.update({
        where: { id: rewardId },
        data: {
          status: RewardStatus.payable,
          paidInvoicesCount: dto.paidInvoicesCount,
          trialPassed: dto.trialPassed,
          payableAt: new Date(),
          approvedBy: user.id,
        },
      }),
    );
    return this.findById(reward.referralId, user);
  }

  async payReward(
    rewardId: string,
    dto: PayRewardDto,
    user: AuthenticatedUser,
  ): Promise<ReferralResponseDto> {
    this.assertFinance(user);
    const reward = await this.getReward(rewardId);
    if (reward.status !== RewardStatus.payable) {
      throw new BadRequestException("Only payable rewards can be paid");
    }
    await this.prisma.withUserContext(user, (tx) =>
      tx.referralRewards.update({
        where: { id: rewardId },
        data: {
          status: RewardStatus.paid,
          paymentMethod: dto.paymentMethod,
          paymentReference: dto.paymentReference,
          fees: new Prisma.Decimal(dto.fees ?? "0.00"),
          paidAt: new Date(),
        },
      }),
    );
    return this.findById(reward.referralId, user);
  }

  async cancelReward(rewardId: string, user: AuthenticatedUser): Promise<ReferralResponseDto> {
    this.assertFinance(user);
    const reward = await this.getReward(rewardId);
    const referral = await this.getReferral(reward.referralId);
    if (reward.status !== RewardStatus.pending && reward.status !== RewardStatus.payable) {
      throw new BadRequestException("Only pending or payable rewards can be cancelled");
    }
    const threeMonthsAfterAttribution = new Date(referral.attributedAt);
    threeMonthsAfterAttribution.setUTCMonth(threeMonthsAfterAttribution.getUTCMonth() + 3);
    if (new Date() >= threeMonthsAfterAttribution) {
      throw new BadRequestException("A reward cannot be cancelled after the three-month retention period");
    }
    await this.prisma.withUserContext(user, (tx) =>
      tx.referralRewards.update({
        where: { id: rewardId },
        data: { status: RewardStatus.cancelled, cancelledAt: new Date(), cancelReason: "Client left before three months" },
      }),
    );
    return this.findById(reward.referralId, user);
  }

  private async mapResponse(referral: any): Promise<ReferralResponseDto> {
    const rewards = await this.prisma.referralRewards.findMany({
      where: { referralId: referral.id },
      orderBy: { createdAt: "asc" },
    });
    return {
      id: referral.id,
      referrerId: referral.referrerId,
      companyId: referral.companyId,
      leadId: referral.leadId,
      referredTalentId: referral.referredTalentId,
      introCompanyName: referral.introCompanyName,
      introContactName: referral.introContactName,
      introContactEmail: referral.introContactEmail,
      introNeed: referral.introNeed,
      status: referral.status,
      attributedAt: referral.attributedAt.toISOString(),
      attributionExpiresAt: referral.attributionExpiresAt.toISOString(),
      rewards: rewards.map((reward: any) => ({
        id: reward.id,
        rewardType: reward.rewardType,
        amount: new Prisma.Decimal(reward.amount).toFixed(2),
        currency: reward.currency,
        status: reward.status,
        paidInvoicesCount: reward.paidInvoicesCount,
        trialPassed: reward.trialPassed,
        paymentMethod: reward.paymentMethod,
        paymentReference: reward.paymentReference,
        fees: new Prisma.Decimal(reward.fees).toFixed(2),
        payableAt: reward.payableAt?.toISOString() ?? null,
        paidAt: reward.paidAt?.toISOString() ?? null,
      })),
    };
  }
}
