import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaService } from "../../prisma/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;
  let mockQueryRaw: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    mockQueryRaw = jest.fn();
    mockQueryRaw.mockResolvedValue([{ 1: 1 }] as never);
    const prisma = {
      $queryRaw: mockQueryRaw,
    } as unknown as PrismaService;
    controller = new HealthController(prisma);
  });

  it("should return ok and connected when db query succeeds", async () => {
    const res = await controller.check();
    expect(res.status).toBe("ok");
    expect(res.database).toBe("connected");
    expect(res.timestamp).toBeDefined();
  });

  it("should throw ServiceUnavailableException when db query fails", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("Connection refused") as never);
    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
