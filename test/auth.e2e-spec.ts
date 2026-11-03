import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { INestApplication, RequestMethod, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `e2e_talent_${Date.now()}@example.com`;
  const testPassword = "StrongPassword123!";
  let currentRefreshToken: string;
  let currentAccessToken: string;

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
    await app.init();
  });

  afterAll(async () => {
    // Cleanup test user
    try {
      await prisma.users.deleteMany({ where: { email: testEmail } });
    } catch {
      // Ignore cleanup error
    }
    await app.close();
  });

  it("POST /api/v1/auth/register should create a talent and return tokens", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send({
        email: testEmail,
        password: testPassword,
        firstName: "Test",
        lastName: "E2E",
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    expect(response.body).toHaveProperty("verificationToken");
    expect(response.body.user.email).toBe(testEmail);
    expect(response.body.user.role).toBe("talent");

    currentRefreshToken = response.body.refreshToken;
    currentAccessToken = response.body.accessToken;
  });

  it("POST /api/v1/auth/login should authenticate user with valid credentials", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    currentRefreshToken = response.body.refreshToken;
    currentAccessToken = response.body.accessToken;
  });

  it("POST /api/v1/auth/login should fail with 401 on incorrect password", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testEmail,
        password: "IncorrectPassword123!",
      });

    expect(response.status).toBe(401);
  });

  it("GET /api/v1/auth/me should return authenticated profile with valid token", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${currentAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.email).toBe(testEmail);
    expect(response.body.role).toBe("talent");
  });

  it("GET /api/v1/auth/me should return 401 without Bearer token", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
  });

  it("POST /api/v1/auth/refresh should rotate refresh token", async () => {
    const oldRefreshToken = currentRefreshToken;

    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: oldRefreshToken });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("accessToken");
    expect(response.body).toHaveProperty("refreshToken");
    expect(response.body.refreshToken).not.toBe(oldRefreshToken);

    currentRefreshToken = response.body.refreshToken;
    currentAccessToken = response.body.accessToken;

    // Verify old refresh token is revoked
    const reuseResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: oldRefreshToken });

    expect(reuseResponse.status).toBe(401);
  });

  it("POST /api/v1/auth/logout should revoke current refresh token", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/auth/logout")
      .send({ refreshToken: currentRefreshToken });

    expect(response.status).toBe(200);

    const checkRefresh = await request(app.getHttpServer())
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: currentRefreshToken });

    expect(checkRefresh.status).toBe(401);
  });
});

