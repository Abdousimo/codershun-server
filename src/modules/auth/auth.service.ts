import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

import { AuthTokenType, UserRole, UserStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { Login2faDto } from "./dto/login-2fa.dto";
import { ResetPasswordDto } from "./dto/password-reset.dto";

const STAFF_ROLES: UserRole[] = [
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.finance,
  UserRole.super_admin,
];

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessTtlSeconds = 900; // 15 minutes
    const refreshDays = this.configService.get<number>("auth.refreshTtlDays", 30);
    this.refreshTtlMs = refreshDays * 24 * 60 * 60 * 1000;
  }

  // ==========================================
  // REGISTRATION & EMAIL VERIFICATION
  // ==========================================

  async register(input: RegisterDto, ip?: string, userAgent?: string) {
    const email = this.normalizeEmail(input.email);
    const passwordHash = await this.hashPassword(input.password);
    const role = input.role ?? UserRole.talent;

    // Staff accounts cannot self-register as active without 2FA
    const status: UserStatus = STAFF_ROLES.includes(role) ? UserStatus.invited : UserStatus.active;

    try {
      const user = await this.prisma.users.create({
        data: {
          email,
          passwordHash,
          role,
          firstName: input.firstName,
          lastName: input.lastName,
          status,
          language: "en",
        },
      });

      // Issue verification token
      const verificationToken = await this.createAuthToken(user.id, email, AuthTokenType.email_verification, 24 * 60);

      this.logger.log(`User registered: ${user.id} (${user.email}, role: ${user.role})`);

      const session = await this.issueSession(user, ip, userAgent);
      return {
        ...session,
        verificationToken, // surfaced in response/logs for email service
      };
    } catch (error) {
      if (this.isPrismaConflict(error)) {
        throw new ConflictException("Email is already registered");
      }
      throw error;
    }
  }

  async verifyEmail(token: string) {
    const authToken = await this.consumeAuthToken(token, AuthTokenType.email_verification);
    await this.prisma.users.update({
      where: { id: authToken.userId! },
      data: { emailVerifiedAt: new Date() },
    });
    return { success: true, message: "Email successfully verified." };
  }

  // ==========================================
  // LOGIN, LOCKOUT & 2FA CHALLENGE
  // ==========================================

  async login(input: LoginDto, ip?: string, userAgent?: string) {
    const email = this.normalizeEmail(input.email);
    const user = await this.prisma.users.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Account is temporarily locked. Please try again in ${waitMinutes} minutes.`);
    }

    const isPasswordValid = await this.verifyPassword(input.password, user.passwordHash);

    if (!isPasswordValid) {
      const failedCount = user.failedLoginCount + 1;
      const lockedUntil = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.prisma.users.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failedCount,
          lockedUntil,
        },
      });

      if (lockedUntil) {
        throw new UnauthorizedException("Too many failed attempts. Account locked for 15 minutes.");
      }
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (user.status !== UserStatus.active && user.status !== UserStatus.invited) {
      throw new UnauthorizedException("User account is suspended or deactivated.");
    }

    // Reset failed logins upon success
    await this.prisma.users.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    // 2FA Challenge if enabled
    if (user.twoFactorEnabled) {
      const preAuthToken = this.jwtService.sign(
        { sub: user.id, isPreAuth: true },
        { expiresIn: "5m" },
      );
      return {
        mfaRequired: true,
        preAuthToken,
      };
    }

    return this.issueSession(user, ip, userAgent);
  }

  async login2fa(input: Login2faDto, ip?: string, userAgent?: string) {
    let payload: { sub: string; isPreAuth?: boolean };
    try {
      payload = this.jwtService.verify(input.preAuthToken);
    } catch {
      throw new UnauthorizedException("Pre-authentication token is invalid or expired.");
    }

    if (!payload.isPreAuth || !payload.sub) {
      throw new UnauthorizedException("Invalid pre-authentication token.");
    }

    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException("2FA is not configured for this account.");
    }

    // Verify TOTP code or recovery code
    let isValidCode = verifySync({ token: input.code, secret: user.twoFactorSecret }).valid;

    if (!isValidCode && user.twoFactorRecoveryCodes.length > 0) {
      const codeIndex = user.twoFactorRecoveryCodes.indexOf(input.code);
      if (codeIndex !== -1) {
        isValidCode = true;
        // Consume recovery code
        const updatedCodes = [...user.twoFactorRecoveryCodes];
        updatedCodes.splice(codeIndex, 1);
        await this.prisma.users.update({
          where: { id: user.id },
          data: { twoFactorRecoveryCodes: updatedCodes },
        });
      }
    }

    if (!isValidCode) {
      throw new UnauthorizedException("Invalid authentication code.");
    }

    return this.issueSession(user, ip, userAgent);
  }

  // ==========================================
  // REFRESH TOKEN ROTATION & LOGOUT
  // ==========================================

  async refresh(refreshToken: string, ip?: string, userAgent?: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.userSessions.findFirst({
      where: { sessionTokenHash: tokenHash },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      if (session?.revokedAt) {
        this.logger.warn(`Suspicious activity: Revoked session token reuse detected for user ${session.userId}`);
      }
      throw new UnauthorizedException("Refresh token is invalid or expired.");
    }

    const user = await this.prisma.users.findUnique({
      where: { id: session.userId },
    });

    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException("User account is inactive or deleted.");
    }

    // Revoke old session (Rotation)
    await this.prisma.userSessions.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Issue fresh session
    return this.issueSession(user, ip, userAgent);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.userSessions.updateMany({
      where: { sessionTokenHash: tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.userSessions.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true, message: "All sessions have been revoked." };
  }

  // ==========================================
  // 2FA CONFIGURATION (TOTP)
  // ==========================================

  async generate2faSecret(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    const secret = generateSecret();
    const otpAuthUrl = generateURI({ secret, label: user.email, issuer: "CodersHub" });
    const qrCodeUrl = await QRCode.toDataURL(otpAuthUrl);

    // Save secret temporarily until confirmed with code
    await this.prisma.users.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return {
      secret,
      otpAuthUrl,
      qrCodeUrl,
    };
  }

  async enable2fa(userId: string, code: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException("2FA setup not initiated. Please generate secret first.");
    }

    const isValid = verifySync({ token: code, secret: user.twoFactorSecret }).valid;
    if (!isValid) {
      throw new BadRequestException("Invalid 2FA code. Please verify against your authenticator app.");
    }

    // Generate 8 random recovery codes
    const recoveryCodes = Array.from({ length: 8 }, () => randomBytes(5).toString("hex"));

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: recoveryCodes,
        status: user.status === UserStatus.invited && STAFF_ROLES.includes(user.role) ? UserStatus.active : user.status,
      },
    });

    return {
      success: true,
      recoveryCodes,
      message: "2FA successfully enabled. Store these recovery codes safely.",
    };
  }

  async disable2fa(userId: string) {
    const user = await this.prisma.users.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");

    if (STAFF_ROLES.includes(user.role) && user.status === UserStatus.active) {
      throw new BadRequestException("2FA is mandatory for agency staff and cannot be disabled.");
    }

    await this.prisma.users.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [],
      },
    });

    return { success: true, message: "2FA successfully disabled." };
  }

  // ==========================================
  // MAGIC LINK & PASSWORD RESET
  // ==========================================

  async requestMagicLink(emailInput: string) {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.users.findUnique({ where: { email } });

    if (!user) {
      // Do not leak user existence
      return { message: "If an account exists, a sign-in link has been sent to your email." };
    }

    const rawToken = await this.createAuthToken(user.id, email, AuthTokenType.magic_link, 15);
    return {
      message: "If an account exists, a sign-in link has been sent to your email.",
      token: rawToken, // in development/test
    };
  }

  async verifyMagicLink(token: string, ip?: string, userAgent?: string) {
    const authToken = await this.consumeAuthToken(token, AuthTokenType.magic_link);
    const user = await this.prisma.users.findUnique({ where: { id: authToken.userId! } });

    if (!user || user.status !== UserStatus.active) {
      throw new UnauthorizedException("User account is inactive or not found.");
    }

    return this.issueSession(user, ip, userAgent);
  }

  async forgotPassword(emailInput: string) {
    const email = this.normalizeEmail(emailInput);
    const user = await this.prisma.users.findUnique({ where: { email } });

    if (!user) {
      return { message: "If your email is registered, password reset instructions have been sent." };
    }

    const rawToken = await this.createAuthToken(user.id, email, AuthTokenType.password_reset, 60);
    return {
      message: "If your email is registered, password reset instructions have been sent.",
      token: rawToken,
    };
  }

  async resetPassword(input: ResetPasswordDto) {
    const authToken = await this.consumeAuthToken(input.token, AuthTokenType.password_reset);
    const newHash = await this.hashPassword(input.newPassword);

    await this.prisma.users.update({
      where: { id: authToken.userId! },
      data: {
        passwordHash: newHash,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    // Revoke all sessions on password change
    await this.logoutAll(authToken.userId!);

    return { success: true, message: "Password updated successfully. You can now log in." };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  async getMe(userId: string): Promise<AuthenticatedUser & { firstName?: string | null; lastName?: string | null }> {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) throw new NotFoundException("User not found");

    const scopes = await this.resolveUserScopes(user.id, user.role);
    return {
      ...user,
      ...scopes,
    };
  }

  private async resolveUserScopes(userId: string, role: UserRole): Promise<{ companyId?: string | null; talentId?: string | null }> {
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

  private async issueSession(user: { id: string; email: string; role: UserRole; firstName?: string | null; lastName?: string | null }, ip?: string, userAgent?: string) {
    const refreshToken = randomBytes(48).toString("base64url");
    const sessionTokenHash = this.hashToken(refreshToken);

    const session = await this.prisma.userSessions.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        ip,
        userAgent,
        expiresAt: new Date(Date.now() + this.refreshTtlMs),
      },
    });

    const scopes = await this.resolveUserScopes(user.id, user.role);

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: scopes.companyId,
      talentId: scopes.talentId,
      sid: session.id,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private async createAuthToken(userId: string, email: string, type: AuthTokenType, ttlMinutes: number): Promise<string> {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = this.hashToken(rawToken);

    await this.prisma.authTokens.create({
      data: {
        userId,
        email,
        type,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
      },
    });

    return rawToken;
  }

  private async consumeAuthToken(rawToken: string, type: AuthTokenType) {
    const tokenHash = this.hashToken(rawToken);
    const authToken = await this.prisma.authTokens.findFirst({
      where: { tokenHash },
    });

    if (!authToken || authToken.type !== type || authToken.usedAt || authToken.expiresAt <= new Date()) {
      throw new UnauthorizedException("Token is invalid, already used, or expired.");
    }

    await this.prisma.authTokens.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    });

    return authToken;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private normalizeEmail(email: string): string {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      throw new BadRequestException("A valid email address is required.");
    }
    return normalized;
  }

  private isPrismaConflict(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
