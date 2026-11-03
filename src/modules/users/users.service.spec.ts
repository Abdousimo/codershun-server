import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";

import { AuthTokenType, UserRole, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  let usersService: UsersService;
  let prisma: Partial<PrismaService>;

  const adminUser: AuthenticatedUser = {
    id: "admin-1",
    email: "admin@codershub.dz",
    role: UserRole.super_admin,
    companyId: null,
    talentId: null,
    sessionId: "sess-admin",
  };

  beforeEach(() => {
    prisma = {
      users: {
        findUnique: jest.fn<any>(),
        findMany: jest.fn<any>(),
        count: jest.fn<any>(),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
      } as any,
      userSessions: {
        updateMany: jest.fn<any>(),
      } as any,
      authTokens: {
        create: jest.fn<any>(),
      } as any,
      staffProfiles: {
        create: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        upsert: jest.fn<any>(),
      } as any,
      talents: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
      } as any,
      companyUsers: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
      } as any,
      withUserContext: jest.fn<any>((user, fn) => fn(prisma)),
    };

    usersService = new UsersService(prisma as PrismaService);
  });

  describe("inviteStaff", () => {
    it("should create staff in invited status and create an invitation auth_token", async () => {
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(null);
      (prisma.users!.create as jest.Mock<any>).mockResolvedValue({
        id: "staff-new",
        email: "recruiter@codershub.dz",
        role: UserRole.recruiter,
        status: UserStatus.invited,
        firstName: "Sarah",
        lastName: "M",
        phone: null,
        language: "en",
        timezone: "Europe/Paris",
        twoFactorEnabled: false,
        lastLoginAt: null,
        createdAt: new Date(),
      });
      (prisma.authTokens!.create as jest.Mock<any>).mockResolvedValue({ id: "token-inv" });
      (prisma.staffProfiles!.create as jest.Mock<any>).mockResolvedValue({
        userId: "staff-new",
        jobTitle: "Senior Recruiter",
        isReviewer: true,
        isExternalReviewer: false,
        reviewerFee: null,
      });

      const result = await usersService.inviteStaff(
        {
          email: "recruiter@codershub.dz",
          role: UserRole.recruiter,
          firstName: "Sarah",
          lastName: "M",
          jobTitle: "Senior Recruiter",
          isReviewer: true,
        },
        adminUser,
      );

      expect(result.id).toBe("staff-new");
      expect(result.status).toBe(UserStatus.invited);
      expect(result.invitationToken).toBeDefined();
      expect(prisma.authTokens!.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "staff-new",
            type: AuthTokenType.invitation,
          }),
        }),
      );
    });

    it("should throw ConflictException on duplicate email", async () => {
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue({ id: "existing" });

      await expect(
        usersService.inviteStaff({ email: "existing@codershub.dz", role: UserRole.sales }, adminUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("updateUser", () => {
    it("should update user role and basic info inside withUserContext", async () => {
      const existing = {
        id: "user-target",
        role: UserRole.recruiter,
        status: UserStatus.invited,
        twoFactorEnabled: false,
      };

      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(existing);
      (prisma.users!.update as jest.Mock<any>).mockResolvedValue({
        ...existing,
        role: UserRole.recruiter_lead,
        firstName: "UpdatedName",
      });

      const res = await usersService.updateUser(
        "user-target",
        { role: UserRole.recruiter_lead, firstName: "UpdatedName" },
        adminUser,
      );

      expect(res.role).toBe(UserRole.recruiter_lead);
      expect(prisma.withUserContext).toHaveBeenCalled();
    });

    it("should reject setting staff role to active when 2FA is disabled (staff_requires_2fa rule)", async () => {
      const existing = {
        id: "user-target",
        role: UserRole.recruiter,
        status: UserStatus.invited,
        twoFactorEnabled: false,
      };

      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(existing);

      await expect(
        usersService.updateUser("user-target", { status: UserStatus.active }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it("should revoke all user sessions when user is deactivated", async () => {
      const existing = {
        id: "user-target",
        role: UserRole.talent,
        status: UserStatus.active,
        twoFactorEnabled: false,
      };

      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(existing);
      (prisma.users!.update as jest.Mock<any>).mockResolvedValue({
        ...existing,
        status: UserStatus.deactivated,
      });

      await usersService.updateUser("user-target", { status: UserStatus.deactivated }, adminUser);

      expect(prisma.userSessions!.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-target", revokedAt: null },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe("softDeleteUser", () => {
    it("should prevent admin from deleting their own account", async () => {
      await expect(usersService.softDeleteUser(adminUser.id, adminUser)).rejects.toThrow(BadRequestException);
    });

    it("should soft delete user and revoke all sessions", async () => {
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue({
        id: "target-user",
        status: UserStatus.active,
      });

      const res = await usersService.softDeleteUser("target-user", adminUser);

      expect(res.success).toBe(true);
      expect(prisma.users!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "target-user" },
          data: expect.objectContaining({
            status: UserStatus.deleted,
            deletedAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.userSessions!.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "target-user", revokedAt: null },
        }),
      );
    });
  });

  describe("findById & getMe", () => {
    it("should throw NotFoundException if user is not found or is deleted", async () => {
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(null);

      await expect(usersService.findById("unknown-id")).rejects.toThrow(NotFoundException);
    });

    it("should return user details and staff profile for staff roles", async () => {
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue({
        id: "staff-1",
        email: "staff@codershub.dz",
        role: UserRole.sales,
        status: UserStatus.active,
        twoFactorEnabled: true,
        createdAt: new Date(),
      });

      (prisma.staffProfiles!.findUnique as jest.Mock<any>).mockResolvedValue({
        userId: "staff-1",
        jobTitle: "Account Executive",
        calendarUrl: "https://cal.com/sales",
        whatsapp: "+213555000111",
        isReviewer: false,
        isExternalReviewer: false,
        reviewerFee: null,
      });

      const res = await usersService.findById("staff-1");

      expect(res.id).toBe("staff-1");
      expect(res.staffProfile?.jobTitle).toBe("Account Executive");
      expect(res.staffProfile?.calendarUrl).toBe("https://cal.com/sales");
    });
  });

  describe("updateMe", () => {
    it("should update personal profile information", async () => {
      (prisma.users!.update as jest.Mock<any>).mockResolvedValue({
        id: "user-me",
        email: "me@example.com",
        role: UserRole.talent,
        status: UserStatus.active,
        firstName: "NewFirst",
        lastName: "NewLast",
        phone: "+213550123456",
        twoFactorEnabled: false,
        createdAt: new Date(),
      });

      const res = await usersService.updateMe(
        "user-me",
        { firstName: "NewFirst", lastName: "NewLast", phone: "+213550123456" },
        adminUser,
      );

      expect(res.firstName).toBe("NewFirst");
      expect(res.lastName).toBe("NewLast");
    });
  });
});

