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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { TimesheetsService } from "../timesheets.service";
import { RejectTimesheetDto } from "../dto/client-timesheet.dto";

@ApiTags("Client / Timesheets")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user, UserRole.super_admin)
@Controller("client/timesheets")
export class ClientTimesheetsController {
  constructor(@Inject(TimesheetsService) private readonly timesheetsService: TimesheetsService) {}

  @Get()
  @ApiOperation({ summary: "Get submitted timesheets and daily logs for client placements" })
  @ApiResponse({ status: 200, description: "Returns array of client timesheet items" })
  async getTimesheets(
    @Query("month") month?: string,
    @Query("periodMonth") periodMonth?: string,
    @Query("placementId") placementId?: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const targetMonth = periodMonth || month;
    return this.timesheetsService.getClientTimesheets(targetMonth, placementId, currentUser!);
  }

  @Post(":id/approve")
  @ApiOperation({ summary: "Approve a submitted monthly timesheet" })
  @ApiResponse({ status: 200, description: "Timesheet approved successfully" })
  async approveTimesheet(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timesheetsService.approveTimesheet(id, currentUser);
  }

  @Post(":id/reject")
  @ApiOperation({ summary: "Reject a timesheet and request revisions from the developer" })
  @ApiResponse({ status: 200, description: "Timesheet returned for correction" })
  async rejectTimesheet(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectTimesheetDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timesheetsService.rejectTimesheet(id, dto.reason, currentUser);
  }
}
