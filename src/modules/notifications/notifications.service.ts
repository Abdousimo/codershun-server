import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationChannel, Prisma, UserRole, UiLanguage } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { QueryNotificationsDto } from "./dto/query-notifications.dto";
import { UpdateNotificationPreferenceDto } from "./dto/notification-preference.dto";
import { UpsertEmailTemplateDto } from "./dto/email-template.dto";

const ADMIN_ROLES: UserRole[] = [UserRole.super_admin, UserRole.finance];

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(query: QueryNotificationsDto, user: AuthenticatedUser) {
    const where: Prisma.NotificationsWhereInput = { userId: user.id };
    if (query.unread !== undefined) where.readAt = query.unread ? null : { not: null };
    const skip = (query.page - 1) * query.pageSize;
    const [total, notifications] = await Promise.all([
      this.prisma.notifications.count({ where }),
      this.prisma.notifications.findMany({
        where,
        skip,
        take: query.pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { data: notifications, meta: { page: query.page, pageSize: query.pageSize, total } };
  }

  async markRead(id: string, user: AuthenticatedUser) {
    const notification = await this.prisma.notifications.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);
    if (notification.userId !== user.id) throw new ForbiddenException("Notification access is denied");
    return this.prisma.notifications.update({ where: { id }, data: { readAt: new Date() } });
  }

  async getPreferences(user: AuthenticatedUser) {
    return this.prisma.notificationPreferences.findMany({
      where: { userId: user.id },
      orderBy: [{ type: "asc" }, { channel: "asc" }],
    });
  }

  async updatePreference(dto: UpdateNotificationPreferenceDto, user: AuthenticatedUser) {
    return this.prisma.notificationPreferences.upsert({
      where: { userId_type_channel: { userId: user.id, type: dto.type, channel: dto.channel } },
      create: { userId: user.id, type: dto.type, channel: dto.channel, enabled: dto.enabled },
      update: { enabled: dto.enabled },
    });
  }

  async create(dto: CreateNotificationDto, actor: AuthenticatedUser) {
    if (!dto.userId && !dto.recipientEmail) {
      throw new BadRequestException("A userId or recipientEmail is required");
    }
    if (dto.channel === NotificationChannel.email && !dto.recipientEmail) {
      throw new BadRequestException("Email notifications require recipientEmail");
    }
    let emailTemplateId: string | undefined;
    if (dto.channel === NotificationChannel.email) {
      if (!dto.templateCode) throw new BadRequestException("Email notifications require templateCode");
      const template = await this.prisma.emailTemplates.findFirst({
        where: { code: dto.templateCode, language: UiLanguage.en, isActive: true },
      });
      if (!template) throw new NotFoundException(`Active email template ${dto.templateCode} not found`);
      emailTemplateId = template.id;
    }
    if (dto.userId) {
      const preference = await this.prisma.notificationPreferences.findUnique({
        where: { userId_type_channel: { userId: dto.userId, type: dto.type, channel: dto.channel } },
      });
      if (preference?.enabled === false) return null;
    }
    return this.prisma.withUserContext(actor, (tx) =>
      tx.notifications.create({
        data: {
          userId: dto.userId,
          recipientEmail: dto.recipientEmail,
          type: dto.type,
          title: dto.title,
          payload: dto.payload ?? {},
          linkUrl: dto.linkUrl,
          channel: dto.channel,
          emailTemplateId,
        },
      }),
    );
  }

  async listTemplates(user: AuthenticatedUser) {
    this.assertAdmin(user);
    return this.prisma.emailTemplates.findMany({ orderBy: [{ code: "asc" }, { language: "asc" }] });
  }

  async upsertTemplate(dto: UpsertEmailTemplateDto, user: AuthenticatedUser) {
    this.assertAdmin(user);
    return this.prisma.withUserContext(user, (tx) =>
      tx.emailTemplates.upsert({
        where: { code_language: { code: dto.code, language: dto.language } },
        create: {
          code: dto.code,
          language: dto.language,
          subject: dto.subject,
          bodyHtml: dto.bodyHtml,
          bodyText: dto.bodyText,
          variables: dto.variables ?? [],
          isActive: dto.isActive ?? true,
          updatedBy: user.id,
        },
        update: {
          subject: dto.subject,
          bodyHtml: dto.bodyHtml,
          bodyText: dto.bodyText,
          variables: dto.variables ?? [],
          isActive: dto.isActive ?? true,
          updatedBy: user.id,
        },
      }),
    );
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (!ADMIN_ROLES.includes(user.role)) throw new ForbiddenException("Notification template access is denied");
  }
}
