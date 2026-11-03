import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { PrismaService } from "../../prisma/prisma.service";

describe("HealthController", () => {
  let controller: HealthController;
  let prisma: Partial<PrismaService>;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    controller = new HealthController(prisma as PrismaService);
  });

  it("should return ok and connected when db query succeeds", async () => {
    const res = await controller.check();
    expect(res.status).toBe("ok");
    expect(res.database).toBe("connected");
    expect(res.timestamp).toBeDefined();
  });

  it("should throw ServiceUnavailableException when db query fails", async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error("Connection refused"));
    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
