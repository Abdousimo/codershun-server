import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { generateSecret, generateSync } from "otplib";

import { AuthTokenType, UserRole, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  let authService: AuthService;
  let prisma: Partial<PrismaService>;
  let jwtService: Partial<JwtService>;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    prisma = {
      users: {
        create: jest.fn<any>(),
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
      } as any,
      userSessions: {
        create: jest.fn<any>(),
        findFirst: jest.fn<any>(),
        update: jest.fn<any>(),
        updateMany: jest.fn<any>(),
      } as any,
      authTokens: {
        create: jest.fn<any>(),
        findFirst: jest.fn<any>(),
        update: jest.fn<any>(),
        deleteMany: jest.fn<any>(),
      } as any,
      talents: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
      } as any,
      companyUsers: {
        findFirst: jest.fn<any>().mockResolvedValue(null),
      } as any,
    };

    jwtService = {
      sign: jest.fn<any>().mockReturnValue("mock.jwt.token"),
      verify: jest.fn<any>(),
    };

    configService = {
      get: jest.fn<any>().mockReturnValue(30),
    };

    const mailService = {
      sendMail: jest.fn<any>().mockResolvedValue(true),
      sendPasswordResetOtp: jest.fn<any>().mockResolvedValue(true),
    };

    authService = new AuthService(
      prisma as PrismaService,
      jwtService as JwtService,
      configService as ConfigService,
      mailService as any,
    );
  });

  describe("Password Hashing (Argon2id)", () => {
    it("should hash password with Argon2id and verify correctly", async () => {
      const password = "SuperSecretPassword123!";
      const hash = await authService.hashPassword(password);

      expect(hash).toMatch(/^\$argon2id\$/);
      expect(await authService.verifyPassword(password, hash)).toBe(true);
      expect(await authService.verifyPassword("WrongPassword!", hash)).toBe(false);
    });
  });

  describe("Register", () => {
    it("should register talent with argon2 hash and create verification token", async () => {
      const mockCreatedUser = {
        id: "user-1",
        email: "talent@example.com",
        role: UserRole.talent,
        firstName: "Karim",
        lastName: "Zidane",
        status: UserStatus.active,
      };

      (prisma.users!.create as jest.Mock<any>).mockResolvedValue(mockCreatedUser);
      (prisma.userSessions!.create as jest.Mock<any>).mockResolvedValue({ id: "session-1" });
      (prisma.authTokens!.create as jest.Mock<any>).mockResolvedValue({ id: "token-1" });

      const result = await authService.register({
        email: "talent@example.com",
        password: "Password123!",
        firstName: "Karim",
        lastName: "Zidane",
      });

      expect(result.accessToken).toBe("mock.jwt.token");
      expect(result.refreshToken).toBeDefined();
      expect(result.verificationToken).toBeDefined();
      expect(prisma.users!.create).toHaveBeenCalled();
      expect(prisma.authTokens!.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            type: AuthTokenType.email_verification,
          }),
        }),
      );
    });

    it("should throw ConflictException on duplicate email", async () => {
      (prisma.users!.create as jest.Mock<any>).mockRejectedValue({ code: "P2002" });

      await expect(
        authService.register({ email: "taken@example.com", password: "Password123!" }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("Login & Lockout (CDC NFR-03)", () => {
    it("should login successfully with correct password", async () => {
      const passwordHash = await authService.hashPassword("ValidPassword123!");
      const mockUser = {
        id: "user-1",
        email: "user@example.com",
        passwordHash,
        role: UserRole.talent,
        status: UserStatus.active,
        twoFactorEnabled: false,
        failedLoginCount: 0,
        lockedUntil: null,
      };

      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(mockUser);
      (prisma.users!.update as jest.Mock<any>).mockResolvedValue(mockUser);
      (prisma.userSessions!.create as jest.Mock<any>).mockResolvedValue({ id: "session-1" });

      const result = await authService.login({
        email: "user@example.com",
        password: "ValidPassword123!",
      });

      expect("accessToken" in result).toBe(true);
      expect(prisma.users!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
        }),
      );
    });

    it("should lock account after 5 failed login attempts", async () => {
      const passwordHash = await authService.hashPassword("RealPassword123!");
      const mockUser = {
        id: "user-1",
        email: "user@example.com",
        passwordHash,
        status: UserStatus.active,
        twoFactorEnabled: false,
        failedLoginCount: 4, // 5th attempt incoming
        lockedUntil: null,
      };

      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(mockUser);
      (prisma.users!.update as jest.Mock<any>).mockResolvedValue(mockUser);

      await expect(
        authService.login({ email: "user@example.com", password: "WrongPassword" }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.users!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginCount: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });

    it("should return mfaRequired and preAuthToken when 2FA is enabled", async () => {
      const passwordHash = await authService.hashPassword("Password123!");
      const mockUser = {
        id: "user-staff",
        email: "staff@codershub.dz",
        passwordHash,
        role: UserRole.recruiter,
        status: UserStatus.active,
        twoFactorEnabled: true,
        failedLoginCount: 0,
        lockedUntil: null,
      };

      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue(mockUser);
      (prisma.users!.update as jest.Mock<any>).mockResolvedValue(mockUser);

      const result = await authService.login({
        email: "staff@codershub.dz",
        password: "Password123!",
      });

      expect(result).toHaveProperty("mfaRequired", true);
      expect(result).toHaveProperty("preAuthToken");
    });
  });

  describe("2FA Verification", () => {
    it("should login with valid TOTP code in login2fa", async () => {
      const secret = generateSecret();
      const code = generateSync({ secret });

      (jwtService.verify as jest.Mock<any>).mockReturnValue({ sub: "user-2fa", isPreAuth: true });
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue({
        id: "user-2fa",
        email: "staff@codershub.dz",
        role: UserRole.recruiter,
        status: UserStatus.active,
        twoFactorSecret: secret,
        twoFactorRecoveryCodes: [],
      });
      (prisma.userSessions!.create as jest.Mock<any>).mockResolvedValue({ id: "session-2" });

      const result = await authService.login2fa({
        preAuthToken: "mock-pre-auth",
        code,
      });

      expect("accessToken" in result).toBe(true);
    });

    it("should block active agency staff from disabling 2FA", async () => {
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue({
        id: "staff-1",
        role: UserRole.super_admin,
        status: UserStatus.active,
        twoFactorEnabled: true,
      });

      await expect(authService.disable2fa("staff-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("Refresh Token Rotation", () => {
    it("should revoke previous session and issue new session tokens", async () => {
      const mockOldSession = {
        id: "old-session",
        userId: "user-1",
        sessionTokenHash: "some-hash",
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
      };

      (prisma.userSessions!.findFirst as jest.Mock<any>).mockResolvedValue(mockOldSession);
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
        role: UserRole.talent,
        status: UserStatus.active,
      });
      (prisma.userSessions!.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.userSessions!.create as jest.Mock<any>).mockResolvedValue({ id: "new-session" });

      const result = await authService.refresh("some-refresh-token");

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(prisma.userSessions!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "old-session" },
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.userSessions!.create).toHaveBeenCalled();
    });

    it("should reject already revoked refresh tokens", async () => {
      (prisma.userSessions!.findFirst as jest.Mock<any>).mockResolvedValue({
        id: "revoked-session",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(authService.refresh("stolen-token")).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("Password Reset with OTP Code", () => {
    it("should generate 6-digit OTP code and send email when forgotPassword is requested", async () => {
      (prisma.users!.findUnique as jest.Mock<any>).mockResolvedValue({
        id: "user-1",
        email: "user@example.com",
      });
      (prisma.authTokens!.deleteMany as jest.Mock<any>).mockResolvedValue({ count: 1 });
      (prisma.authTokens!.findFirst as jest.Mock<any>).mockResolvedValue(null);
      (prisma.authTokens!.create as jest.Mock<any>).mockResolvedValue({ id: "token-1" });

      const result = await authService.forgotPassword("user@example.com");

      expect(result.message).toContain("password reset code has been sent");
      expect(result.code).toMatch(/^\d{6}$/);
      expect(prisma.authTokens!.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            email: "user@example.com",
            type: AuthTokenType.password_reset,
          }),
        }),
      );
    });

    it("should verify valid OTP code successfully", async () => {
      const code = "123456";
      (prisma.authTokens!.findFirst as jest.Mock<any>).mockResolvedValue({
        id: "token-1",
        email: "user@example.com",
        usedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      const result = await authService.verifyResetCode(code, "user@example.com");
      expect(result.valid).toBe(true);
      expect(result.email).toBe("user@example.com");
    });

    it("should reject expired or invalid OTP code", async () => {
      (prisma.authTokens!.findFirst as jest.Mock<any>).mockResolvedValue(null);
      await expect(authService.verifyResetCode("999999")).rejects.toThrow(UnauthorizedException);
    });

    it("should reset password and revoke all sessions using OTP code", async () => {
      const code = "123456";
      (prisma.authTokens!.findFirst as jest.Mock<any>).mockResolvedValue({
        id: "token-1",
        userId: "user-1",
        email: "user@example.com",
        usedAt: null,
        expiresAt: new Date(Date.now() + 600000),
      });
      (prisma.authTokens!.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.users!.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.userSessions!.updateMany as jest.Mock<any>).mockResolvedValue({ count: 2 });

      const result = await authService.resetPassword({
        code,
        token: code,
        email: "user@example.com",
        newPassword: "BrandNewPassword123!",
      });

      expect(result.success).toBe(true);
      expect(prisma.authTokens!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "token-1" },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      );
      expect(prisma.users!.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "user-1" },
          data: expect.objectContaining({ failedLoginCount: 0, lockedUntil: null }),
        }),
      );
      expect(prisma.userSessions!.updateMany).toHaveBeenCalled();
    });
  });
});

