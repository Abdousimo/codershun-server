import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { NotificationChannel, UserRole, UiLanguage } from "../../generated/prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { NotificationsService } from "./notifications.service";

const resolved = <T>(value: T) => (jest.fn() as any).mockResolvedValue(value);

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: any;
  const admin: AuthenticatedUser = {
    id: "admin-1",
    email: "admin@example.com",
    role: UserRole.super_admin,
  };
  const user: AuthenticatedUser = {
    id: "user-1",
    email: "user@example.com",
    role: UserRole.talent,
  };

  beforeEach(() => {
    prisma = {
      notifications: {
        create: resolved({ id: "notification-1", userId: "user-1" }),
        findUnique: resolved({ id: "notification-1", userId: "user-1" }),
        findMany: resolved([]),
        count: resolved(0),
        update: resolved({ id: "notification-1", readAt: new Date() }),
      },
      notificationPreferences: {
        findUnique: resolved(null),
        findMany: resolved([]),
        upsert: resolved({ userId: "user-1", type: "welcome", channel: NotificationChannel.in_app, enabled: false }),
      },
      emailTemplates: {
        findFirst: resolved({ id: "template-1", code: "welcome", language: UiLanguage.en, isActive: true }),
        findMany: resolved([]),
        upsert: resolved({ id: "template-1" }),
      },
      withUserContext: jest.fn<any>().mockImplementation(
        (_actor: AuthenticatedUser, callback: (tx: any) => unknown) => callback(prisma),
      ),
    };
    service = new NotificationsService(prisma);
  });

  it("creates an in-app notification for the authenticated recipient", async () => {
    await service.create(
      { userId: "user-1", type: "welcome", channel: NotificationChannel.in_app, title: "Welcome" },
      admin,
    );

    expect(prisma.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", channel: NotificationChannel.in_app }),
      }),
    );
  });

  it("requires a template and recipient email for email notifications", async () => {
    await expect(
      service.create(
        { userId: "user-1", type: "welcome", channel: NotificationChannel.email },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("honors disabled notification preferences", async () => {
    prisma.notificationPreferences.findUnique.mockResolvedValueOnce({ enabled: false });

    const result = await service.create(
      { userId: "user-1", type: "welcome", channel: NotificationChannel.in_app },
      admin,
    );

    expect(result).toBeNull();
    expect(prisma.notifications.create).not.toHaveBeenCalled();
  });

  it("prevents reading another user's notification", async () => {
    await expect(service.markRead("notification-1", { ...user, id: "other-user" })).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("allows administrators to upsert localized templates", async () => {
    await service.upsertTemplate(
      {
        code: "welcome",
        language: UiLanguage.fr,
        subject: "Bienvenue",
        bodyHtml: "<p>Bonjour</p>",
        variables: ["name"],
      },
      admin,
    );

    expect(prisma.emailTemplates.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code_language: { code: "welcome", language: UiLanguage.fr } },
      }),
    );
  });
});
