import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { RolesGuard } from "./roles.guard";
import type { UserRole } from "../../generated/prisma/client";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const createMockContext = (user?: { role: UserRole }) => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it("should allow access when no roles are required", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    const ctx = createMockContext({ role: "talent" });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should allow super_admin regardless of required roles", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["finance"]);
    const ctx = createMockContext({ role: "super_admin" });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should allow access when user role matches required roles", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["sales", "recruiter"]);
    const ctx = createMockContext({ role: "sales" });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("should throw ForbiddenException when user has insufficient role", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["finance"]);
    const ctx = createMockContext({ role: "talent" });

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("should throw ForbiddenException when no user is attached to request", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(["talent"]);
    const ctx = createMockContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
