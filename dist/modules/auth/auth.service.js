var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable, UnauthorizedException, } from "@nestjs/common";
import { createHash, createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterDto } from "./dto/register.dto";
const scrypt = promisify(nodeScrypt);
const ACCESS_TOKEN_TTL_SECONDS = 900;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
let AuthService = class AuthService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async register(input) {
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
        }
        catch (error) {
            if (this.isPrismaConflict(error))
                throw new ConflictException("Email is already registered");
            throw error;
        }
    }
    async login(input) {
        const user = await this.prisma.users.findUnique({
            where: { email: this.normalizeEmail(input.email) },
        });
        if (!user?.passwordHash || !(await this.verifyPassword(input.password, user.passwordHash))) {
            throw new UnauthorizedException("Invalid email or password");
        }
        if (user.status !== "active")
            throw new UnauthorizedException("User account is not active");
        return this.issueSession(user.id, user.email, user.role);
    }
    async refresh(input) {
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
    async logout(refreshToken) {
        await this.prisma.userSessions.updateMany({
            where: { sessionTokenHash: this.hashToken(refreshToken), revokedAt: null },
            data: { revokedAt: new Date() },
        });
        return { loggedOut: true };
    }
    async verifyAccessToken(token) {
        try {
            const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
            if (!encodedHeader || !encodedPayload || !encodedSignature)
                throw new Error("Malformed token");
            const expected = this.sign(`${encodedHeader}.${encodedPayload}`);
            if (!this.safeEqual(expected, encodedSignature))
                throw new Error("Invalid signature");
            const payload = JSON.parse(this.decode(encodedPayload));
            if (payload.exp <= Math.floor(Date.now() / 1000))
                throw new Error("Expired token");
            return { id: payload.sub, email: payload.email, role: payload.role };
        }
        catch {
            throw new UnauthorizedException("Access token is invalid or expired");
        }
    }
    async issueSession(id, email, role) {
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
    signAccessToken(payload) {
        const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS };
        const header = this.encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const encodedBody = this.encode(JSON.stringify(body));
        return `${header}.${encodedBody}.${this.sign(`${header}.${encodedBody}`)}`;
    }
    sign(value) {
        const secret = process.env.AUTH_SECRET?.trim();
        if (!secret || secret.length < 32)
            throw new Error("AUTH_SECRET must contain at least 32 characters");
        return createHmac("sha256", secret).update(value).digest("base64url");
    }
    encode(value) {
        return Buffer.from(value).toString("base64url");
    }
    decode(value) {
        return Buffer.from(value, "base64url").toString("utf8");
    }
    hashToken(token) {
        return createHash("sha256").update(token).digest("hex");
    }
    async hashPassword(password) {
        const salt = randomBytes(16).toString("hex");
        const derivedKey = (await scrypt(password, salt, 64));
        return `scrypt$${salt}$${derivedKey.toString("hex")}`;
    }
    async verifyPassword(password, stored) {
        const [, salt, key] = stored.split("$");
        if (!salt || !key)
            return false;
        const derivedKey = (await scrypt(password, salt, 64));
        return this.safeEqual(derivedKey.toString("hex"), key);
    }
    safeEqual(left, right) {
        const a = Buffer.from(left);
        const b = Buffer.from(right);
        return a.length === b.length && timingSafeEqual(a, b);
    }
    normalizeEmail(email) {
        const normalized = email?.trim().toLowerCase();
        if (!normalized || !normalized.includes("@"))
            throw new UnauthorizedException("A valid email is required");
        return normalized;
    }
    validatePassword(password) {
        if (!password || password.length < 8) {
            throw new UnauthorizedException("Password must contain at least 8 characters");
        }
    }
    isPrismaConflict(error) {
        return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    }
};
AuthService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], AuthService);
export { AuthService };
