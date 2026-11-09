import { Controller, Get, HttpStatus, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "Check API health and database connectivity" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "The service and database are operational.",
    schema: {
      example: {
        status: "ok",
        timestamp: "2026-11-03T11:00:00.000Z",
        database: "connected",
      },
    },
  })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: "connected",
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: "error",
        timestamp: new Date().toISOString(),
        database: "disconnected",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

