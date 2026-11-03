import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { NotificationsService } from "../notifications.service";
import { CreateNotificationDto } from "../dto/create-notification.dto";
import { UpsertEmailTemplateDto } from "../dto/email-template.dto";

@ApiTags("Admin / Notifications")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("admin/notifications")
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("templates")
  @ApiOperation({ summary: "List localized email templates" })
  @Roles(UserRole.super_admin, UserRole.finance)
  listTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.listTemplates(user);
  }

  @Post("templates")
  @ApiOperation({ summary: "Create or update an email template" })
  @Roles(UserRole.super_admin, UserRole.finance)
  upsertTemplate(@Body() dto: UpsertEmailTemplateDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.upsertTemplate(dto, user);
  }

  @Post()
  @ApiOperation({ summary: "Create an in-app, email or Slack notification" })
  @Roles(UserRole.super_admin, UserRole.finance)
  create(@Body() dto: CreateNotificationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.create(dto, user);
  }
}
