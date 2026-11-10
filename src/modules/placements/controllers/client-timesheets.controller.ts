import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { TimesheetsService } from "../timesheets.service";

@ApiTags("Client / Timesheets")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user, UserRole.super_admin)
@Controller("client/timesheets")
export class ClientTimesheetsController {
  constructor(@Inject(TimesheetsService) private readonly timesheetsService: TimesheetsService) {}

  @Get()
  @ApiOperation({ summary: "Get submitted timesheets and daily logs for client placements" })
  async getTimesheets(
    @Query("month") month: string,
    @Query("placementId") placementId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timesheetsService.getClientTimesheets(month, placementId, currentUser);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "Approve a submitted monthly timesheet" })
  async approveTimesheet(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timesheetsService.approveTimesheet(id, currentUser);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a timesheet and request revisions from the developer" })
  async rejectTimesheet(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("reason") reason: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timesheetsService.rejectTimesheet(id, reason, currentUser);
  }
}

