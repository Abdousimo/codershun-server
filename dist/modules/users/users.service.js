var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../infrastructure/database/prisma.service";
let UsersService = class UsersService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(skip = 0, take = 50) {
        return this.prisma.users.findMany({
            skip,
            take: Math.min(take, 100),
            orderBy: { createdAt: "desc" },
            omit: { passwordHash: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
        });
    }
    async findOne(id) {
        const user = await this.prisma.users.findUnique({
            where: { id },
            omit: { passwordHash: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
        });
        if (!user)
            throw new NotFoundException("User not found");
        return user;
    }
    async update(id, data) {
        await this.findOne(id);
        try {
            return await this.prisma.users.update({
                where: { id },
                data: { ...data, role: data.role },
                omit: { passwordHash: true, twoFactorSecret: true, twoFactorRecoveryCodes: true },
            });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new ConflictException("A user with this email already exists");
            }
            throw error;
        }
    }
    async remove(id) {
        await this.findOne(id);
        await this.prisma.users.delete({ where: { id } });
        return { deleted: true };
    }
};
UsersService = __decorate([
    Injectable(),
    __metadata("design:paramtypes", [PrismaService])
], UsersService);
export { UsersService };
