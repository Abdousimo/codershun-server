import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import { AuthTokenType, Prisma, UserRole, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateStaffProfileDto } from "./dto/update-staff-profile.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { QueryUsersDto } from "./dto/query-users.dto";
import { PaginatedUsersResponseDto, UserDetailResponseDto, UserSummaryResponseDto } from "./dto/user-response.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.finance,
  UserRole.super_admin,
];

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ==========================================
  // ADMIN: INVITE STAFF
  // ==========================================

  async inviteStaff(input: InviteStaffDto, adminUser: AuthenticatedUser) {
    const email = input.email.trim().toLowerCase();

    const existing = await this.prisma.users.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException("A user with this email address already exists.");
    }

    return this.prisma.withUserContext(adminUser, async (tx) => {
      // Create user in status 'invited' (satisfies staff_requires_2fa constraint)
      const user = await tx.users.create({
        data: {
          email,
          role: input.role,
          firstName: input.firstName,
          lastName: input.lastName,
          status: UserStatus.invited,
          twoFactorEnabled: false,
          language: "en",
          timezone: "Europe/Paris",
          createdBy: adminUser.id,
        },
      });

      // Generate single-use invitation token (7 days validity)
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");

      await tx.authTokens.create({
        data: {
          userId: user.id,
          email,
          type: AuthTokenType.invitation,
          tokenHash,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Create staff profile
      const staffProfile = await tx.staffProfiles.create({
        data: {
          userId: user.id,
          jobTitle: input.jobTitle,
          calendarUrl: input.calendarUrl,
          whatsapp: input.whatsapp,
          isReviewer: input.isReviewer ?? false,
          reviewerFee: input.reviewerFee !== undefined ? new Prisma.Decimal(input.reviewerFee) : null,
        },
      });

      this.logger.log(`Staff invited: ${user.id} (${email}, role: ${user.role}) by ${adminUser.id}`);

      return {
        ...this.sanitizeUser(user),
        staffProfile: this.formatStaffProfile(staffProfile),
        invitationToken: rawToken,
      };
    });
  }

  // ==========================================
  // ADMIN: LIST & SEARCH USERS
  // ==========================================

  async findAll(query: QueryUsersDto): Promise<PaginatedUsersResponseDto> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.UsersWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }
    if (query.status) {
      where.status = query.status;
    } else {
      // By default exclude deleted users
      where.status = { not: UserStatus.deleted };
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { email: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          firstName: true,
          lastName: true,
          phone: true,
          language: true,
          timezone: true,
          twoFactorEnabled: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      data: users,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ==========================================
  // ADMIN: GET USER DETAILS
  // ==========================================

  async findById(id: string): Promise<UserDetailResponseDto> {
    const user = await this.prisma.users.findUnique({
      where: { id },
    });

    if (!user || user.status === UserStatus.deleted) {
      throw new NotFoundException("User not found.");
    }

    const staffProfile = STAFF_ROLES.includes(user.role)
      ? await this.prisma.staffProfiles.findUnique({ where: { userId: user.id } })
      : null;

    const scopes = await this.resolveScopes(user.id, user.role);

    return {
      ...this.sanitizeUser(user),
      staffProfile: staffProfile ? this.formatStaffProfile(staffProfile) : null,
      companyId: scopes.companyId,
      talentId: scopes.talentId,
    };
  }

  // ==========================================
  // ADMIN: UPDATE USER
  // ==========================================

  async updateUser(id: string, input: UpdateUserDto, adminUser: AuthenticatedUser): Promise<UserSummaryResponseDto> {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user || user.status === UserStatus.deleted) {
      throw new NotFoundException("User not found.");
    }

    const targetRole = input.role ?? user.role;
    const targetStatus = input.status ?? user.status;

    // Enforce business rule & DB constraint staff_requires_2fa:
    // If user has a staff role and status is active, 2FA MUST be enabled.
    if (STAFF_ROLES.includes(targetRole) && targetStatus === UserStatus.active && !user.twoFactorEnabled) {
      throw new BadRequestException(
        "Cannot activate an agency staff account without 2FA enabled (rule staff_requires_2fa). User must set up 2FA before becoming active.",
      );
    }

    return this.prisma.withUserContext(adminUser, async (tx) => {
      const updated = await tx.users.update({
        where: { id },
        data: {
          role: input.role,
          status: input.status,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          language: input.language,
          timezone: input.timezone,
        },
      });

      // If deactivated or suspended, revoke all active sessions immediately
      if (input.status === UserStatus.deactivated || input.status === UserStatus.suspended) {
        await tx.userSessions.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        this.logger.log(`User ${id} sessions revoked due to status change: ${input.status}`);
      }

      return this.sanitizeUser(updated);
    });
  }

  // ==========================================
  // ADMIN: SOFT DELETE USER
  // ==========================================

  async softDeleteUser(id: string, adminUser: AuthenticatedUser) {
    if (id === adminUser.id) {
      throw new BadRequestException("You cannot delete your own account.");
    }

    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user || user.status === UserStatus.deleted) {
      throw new NotFoundException("User not found.");
    }

    await this.prisma.withUserContext(adminUser, async (tx) => {
      await tx.users.update({
        where: { id },
        data: {
          status: UserStatus.deleted,
          deletedAt: new Date(),
        },
      });

      // Revoke all sessions
      await tx.userSessions.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.logger.log(`User ${id} soft-deleted by admin ${adminUser.id}`);
    return { success: true, message: "User deleted successfully." };
  }

  // ==========================================
  // STAFF PROFILE MANAGEMENT
  // ==========================================

  async updateStaffProfile(userId: string, input: UpdateStaffProfileDto, adminUser: AuthenticatedUser) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user || user.status === UserStatus.deleted) {
      throw new NotFoundException("User not found.");
    }

    const profile = await this.prisma.withUserContext(adminUser, async (tx) => {
      return tx.staffProfiles.upsert({
        where: { userId },
        update: {
          jobTitle: input.jobTitle,
          whatsapp: input.whatsapp,
          calendarUrl: input.calendarUrl,
          slackUserId: input.slackUserId,
          isReviewer: input.isReviewer,
          isExternalReviewer: input.isExternalReviewer,
          reviewerFee: input.reviewerFee !== undefined ? new Prisma.Decimal(input.reviewerFee) : undefined,
        },
        create: {
          userId,
          jobTitle: input.jobTitle,
          whatsapp: input.whatsapp,
          calendarUrl: input.calendarUrl,
          slackUserId: input.slackUserId,
          isReviewer: input.isReviewer ?? false,
          isExternalReviewer: input.isExternalReviewer ?? false,
          reviewerFee: input.reviewerFee !== undefined ? new Prisma.Decimal(input.reviewerFee) : null,
        },
      });
    });

    return this.formatStaffProfile(profile as any);
  }

  // ==========================================
  // SELF SERVICE (CURRENT USER)
  // ==========================================

  async getMe(userId: string): Promise<UserDetailResponseDto> {
    return this.findById(userId);
  }

  async updateMe(userId: string, input: UpdateMeDto, actingUser: AuthenticatedUser): Promise<UserSummaryResponseDto> {
    return this.prisma.withUserContext(actingUser, async (tx) => {
      const updated = await tx.users.update({
        where: { id: userId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          language: input.language,
          timezone: input.timezone,
        },
      });
      return this.sanitizeUser(updated);
    });
  }

  // ==========================================
  // SANITIZATION & HELPERS
  // ==========================================

  private sanitizeUser(user: {
    id: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    language: any;
    timezone: string;
    twoFactorEnabled: boolean;
    lastLoginAt?: Date | null;
    createdAt: Date;
  }): UserSummaryResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      language: user.language,
      timezone: user.timezone,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private formatStaffProfile(profile: {
    userId: string;
    jobTitle?: string | null;
    whatsapp?: string | null;
    calendarUrl?: string | null;
    slackUserId?: string | null;
    isReviewer: boolean;
    isExternalReviewer: boolean;
    reviewerFee?: Prisma.Decimal | null;
  }) {
    return {
      userId: profile.userId,
      jobTitle: profile.jobTitle,
      whatsapp: profile.whatsapp,
      calendarUrl: profile.calendarUrl,
      slackUserId: profile.slackUserId,
      isReviewer: profile.isReviewer,
      isExternalReviewer: profile.isExternalReviewer,
      reviewerFee: profile.reviewerFee ? Number(profile.reviewerFee) : null,
    };
  }

  private async resolveScopes(userId: string, role: UserRole) {
    if (role === UserRole.talent) {
      const talent = await this.prisma.talents.findFirst({
        where: { userId },
        select: { id: true },
      });
      return { talentId: talent?.id ?? null, companyId: null };
    }

    if (role === UserRole.client_user || role === UserRole.client_admin) {
      const companyUser = await this.prisma.companyUsers.findFirst({
        where: { userId },
        select: { companyId: true },
      });
      return { companyId: companyUser?.companyId ?? null, talentId: null };
    }

    return { companyId: null, talentId: null };
  }
}
