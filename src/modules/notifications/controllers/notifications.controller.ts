import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { NotificationsService } from "../notifications.service";
import { QueryNotificationsDto } from "../dto/query-notifications.dto";
import { UpdateNotificationPreferenceDto } from "../dto/notification-preference.dto";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List my notifications" })
  list(@Query() query: QueryNotificationsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.list(query, user);
  }

  @Get("preferences")
  @ApiOperation({ summary: "Get my notification preferences" })
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getPreferences(user);
  }

  @Patch("preferences")
  @ApiOperation({ summary: "Update a notification preference" })
  updatePreference(@Body() dto: UpdateNotificationPreferenceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.updatePreference(dto, user);
  }

  @Patch(":id/read")
  @ApiOperation({ summary: "Mark a notification as read" })
  markRead(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markRead(id, user);
  }
}
