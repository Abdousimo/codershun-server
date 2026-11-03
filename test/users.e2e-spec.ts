import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { INestApplication, RequestMethod, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { UserRole, UserStatus } from "../src/generated/prisma/client";

describe("UsersController & AdminUsersController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let superAdminToken: string;
  let talentToken: string;
  let talentUserId: string;

  const adminEmail = `e2e_admin_${Date.now()}@codershub.dz`;
  const talentEmail = `e2e_talent_user_${Date.now()}@example.com`;
  const invitedStaffEmail = `e2e_invited_recruiter_${Date.now()}@codershub.dz`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1", {
      exclude: [{ path: "", method: RequestMethod.GET }],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    await app.init();

    // Create super_admin user
    const adminUser = await prisma.users.create({
      data: {
        email: adminEmail,
        role: UserRole.super_admin,
        status: UserStatus.active,
        twoFactorEnabled: true,
        firstName: "Super",
        lastName: "Admin",
      },
    });

    superAdminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: adminUser.role,
    });

    // Create regular talent user
    const talentUser = await prisma.users.create({
      data: {
        email: talentEmail,
        role: UserRole.talent,
        status: UserStatus.active,
        twoFactorEnabled: false,
        firstName: "Talent",
        lastName: "One",
      },
    });
    talentUserId = talentUser.id;

    talentToken = jwtService.sign({
      sub: talentUser.id,
      email: talentUser.email,
      role: talentUser.role,
    });
  });

  afterAll(async () => {
    try {
      await prisma.users.deleteMany({
        where: {
          email: {
            in: [adminEmail, talentEmail, invitedStaffEmail],
          },
        },
      });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  it("GET /api/v1/admin/users should return 401 without Bearer token", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/admin/users");
    expect(response.status).toBe(401);
  });

  it("GET /api/v1/admin/users should return 403 Forbidden for non-super-admin (talent)", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/users")
      .set("Authorization", `Bearer ${talentToken}`);

    expect(response.status).toBe(403);
  });

  it("GET /api/v1/admin/users should return 200 with paginated users for super_admin", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/admin/users?page=1&pageSize=10")
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("meta");
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.meta.page).toBe(1);
  });

  it("POST /api/v1/admin/users/invite should invite staff in 'invited' status", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/admin/users/invite")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        email: invitedStaffEmail,
        role: "recruiter",
        firstName: "Nadia",
        lastName: "Toumi",
        jobTitle: "Technical Recruiter",
      });

    expect(response.status).toBe(201);
    expect(response.body.email).toBe(invitedStaffEmail);
    expect(response.body.role).toBe("recruiter");
    expect(response.body.status).toBe("invited");
    expect(response.body).toHaveProperty("invitationToken");
    expect(response.body.staffProfile?.jobTitle).toBe("Technical Recruiter");
  });

  it("GET /api/v1/users/me should return current user profile", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${talentToken}`);

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(talentUserId);
    expect(response.body.email).toBe(talentEmail);
    expect(response.body.role).toBe("talent");
  });

  it("PATCH /api/v1/users/me should update current user profile", async () => {
    const response = await request(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${talentToken}`)
      .send({
        firstName: "UpdatedFirstName",
        phone: "+213550111222",
      });

    expect(response.status).toBe(200);
    expect(response.body.firstName).toBe("UpdatedFirstName");
    expect(response.body.phone).toBe("+213550111222");
  });
});

