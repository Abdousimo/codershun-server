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

@ApiTags("Talent / Timesheets")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/timesheets")
export class TalentTimesheetsController {
  constructor(@Inject(TimesheetsService) private readonly timesheetsService: TimesheetsService) {}

  @Get()
  @ApiOperation({ summary: "Get timesheet, calendar entries, and absences for given month/placement" })
  async getTimesheets(
    @Query("month") month?: string,
    @Query("placementId") placementId?: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    return this.timesheetsService.getTalentTimesheets(month, placementId, currentUser);
  }

  @Post("entries")
  @ApiOperation({ summary: "Save or update daily timesheet entries" })
  async saveEntries(
    @Body() body: { placementId: string; month: string; entries: Array<{ workDate: string; hours: number; note?: string; task?: string }> },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timesheetsService.saveEntries(body.placementId, body.month, body.entries, currentUser);
  }

  @Post(":id/submit")
  @ApiOperation({ summary: "Submit timesheet for client sign-off" })
  async submitTimesheet(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.timesheetsService.submitTimesheet(id, currentUser);
  }
}

