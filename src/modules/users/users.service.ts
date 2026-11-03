import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { Prisma, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(skip = 0, take = 50) {
    return this.prisma.users.findMany({
      skip,
      take: Math.min(take, 100),
      orderBy: { createdAt: "desc" },
      omit: { passwordHash: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.users.findUnique({
      where: { id },
      omit: { passwordHash: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async update(id: string, data: Prisma.UsersUncheckedUpdateInput) {
    await this.findOne(id);
    try {
      return await this.prisma.users.update({
        where: { id },
        data: { ...data, role: data.role as UserRole | undefined },
        omit: { passwordHash: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A user with this email already exists");
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.users.delete({ where: { id } });
    return { deleted: true };
  }
}
