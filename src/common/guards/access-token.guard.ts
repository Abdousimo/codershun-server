import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import type { AuthenticatedRequest, AuthenticatedUser } from "../types/authenticated-request";

interface JwtPayload {
  sub: string;
  email: string;
  role: AuthenticatedUser["role"];
  companyId?: string | null;
  talentId?: string | null;
  sid?: string | null;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Bearer access token is required.");
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId ?? null,
        talentId: payload.talentId ?? null,
        sessionId: payload.sid ?? null,
      };

      return true;
    } catch {
      throw new UnauthorizedException("Access token is invalid or expired.");
    }
  }
}
