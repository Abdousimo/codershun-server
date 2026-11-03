import { Injectable, Logger } from "@nestjs/common";
import type { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../generated/prisma/client";

export interface UserContext {
  id?: string;
  role?: string;
  companyId?: string | null;
  talentId?: string | null;
  ip?: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>("database.url") ?? process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }

    const adapter = new PrismaPg({ connectionString: databaseUrl });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("Prisma connected to PostgreSQL");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("Prisma disconnected from PostgreSQL");
  }

  /**
   * Helper that executes an interactive transaction with PostgreSQL session
   * variables (SET LOCAL app.user_id, app.role, app.ip, app.company_id, app.talent_id)
   * so DB triggers (audit log, status history) and RLS know who acted.
   */
  async withUserContext<T>(
    user: UserContext,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      if (user.id) {
        await tx.$executeRawUnsafe(`SET LOCAL app.user_id = '${user.id.replace(/'/g, "''")}'`);
      }
      if (user.role) {
        await tx.$executeRawUnsafe(`SET LOCAL app.role = '${user.role.replace(/'/g, "''")}'`);
      }
      if (user.ip) {
        await tx.$executeRawUnsafe(`SET LOCAL app.ip = '${user.ip.replace(/'/g, "''")}'`);
      }
      if (user.companyId) {
        await tx.$executeRawUnsafe(`SET LOCAL app.company_id = '${user.companyId.replace(/'/g, "''")}'`);
      }
      if (user.talentId) {
        await tx.$executeRawUnsafe(`SET LOCAL app.talent_id = '${user.talentId.replace(/'/g, "''")}'`);
      }

      return fn(tx);
    });
  }
}

