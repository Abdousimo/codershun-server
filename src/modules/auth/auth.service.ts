import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { PrismaService } from "../../infrastructure/database/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";

const scrypt = promisify(nodeScrypt);
const ACCESS_TOKEN_TTL_SECONDS = 900;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type TokenPayload = {
  sub: string;
  email: string;
  role: string;
  exp: number;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDto) {
    const email = this.normalizeEmail(input.email);
    this.validatePassword(input.password);
    const passwordHash = await this.hashPassword(input.password);

    try {
      const user = await this.prisma.users.create({
        data: {
          email,
          passwordHash,
          role: "talent",
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });
      return this.issueSession(user.id, user.email, user.role);
    } catch (error) {
      if (this.isPrismaConflict(error)) throw new ConflictException("Email is already registered");
      throw error;
    }
  }

  async login(input: LoginDto) {
    const user = await this.prisma.users.findUnique({
      where: { email: this.normalizeEmail(input.email) },
    });
    if (!user?.passwordHash || !(await this.verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status !== "active") throw new UnauthorizedException("User account is not active");
    return this.issueSession(user.id, user.email, user.role);
  }

  async refresh(input: RefreshTokenDto) {
    const tokenHash = this.hashToken(input.refreshToken);
    const session = await this.prisma.userSessions.findFirst({
      where: { sessionTokenHash: tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    const user = session
      ? await this.prisma.users.findUnique({ where: { id: session.userId } })
      : null;
    if (!session || !user || user.status !== "active") {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }
    return {
      accessToken: this.signAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
    };
  }

  async logout(refreshToken: string) {
    await this.prisma.userSessions.updateMany({
      where: { sessionTokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async verifyAccessToken(token: string) {
    try {
      const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
      if (!encodedHeader || !encodedPayload || !encodedSignature) throw new Error("Malformed token");
      const expected = this.sign(`${encodedHeader}.${encodedPayload}`);
      if (!this.safeEqual(expected, encodedSignature)) throw new Error("Invalid signature");
      const payload = JSON.parse(this.decode(encodedPayload)) as TokenPayload;
      if (payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("Expired token");
      return { id: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new UnauthorizedException("Access token is invalid or expired");
    }
  }

  private async issueSession(id: string, email: string, role: string) {
    const refreshToken = randomBytes(48).toString("base64url");
    await this.prisma.userSessions.create({
      data: {
        userId: id,
        sessionTokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return {
      accessToken: this.signAccessToken({ sub: id, email, role }),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private signAccessToken(payload: Omit<TokenPayload, "exp">) {
    const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS };
    const header = this.encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const encodedBody = this.encode(JSON.stringify(body));
    return `${header}.${encodedBody}.${this.sign(`${header}.${encodedBody}`)}`;
  }

  private sign(value: string) {
    const secret = process.env.AUTH_SECRET?.trim();
    if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
    return createHmac("sha256", secret).update(value).digest("base64url");
  }

  private encode(value: string) {
    return Buffer.from(value).toString("base64url");
  }

  private decode(value: string) {
    return Buffer.from(value, "base64url").toString("utf8");
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt}$${derivedKey.toString("hex")}`;
  }

  private async verifyPassword(password: string, stored: string) {
    const [, salt, key] = stored.split("$");
    if (!salt || !key) return false;
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    return this.safeEqual(derivedKey.toString("hex"), key);
  }

  private safeEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private normalizeEmail(email: string) {
    const normalized = email?.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) throw new UnauthorizedException("A valid email is required");
    return normalized;
  }

  private validatePassword(password: string) {
    if (!password || password.length < 8) {
      throw new UnauthorizedException("Password must contain at least 8 characters");
    }
  }

  private isPrismaConflict(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
  }
}
