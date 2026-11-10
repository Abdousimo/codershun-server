import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { TalentsService } from "../talents.service";

@ApiTags("Talent / Dashboard")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/dashboard")
export class TalentDashboardController {
  constructor(@Inject(TalentsService) private readonly talentsService: TalentsService) {}

  @Get()
  @ApiOperation({
    summary: "Get aggregated dashboard metrics for talent (pipeline, active placement, timesheet, payouts, interviews)",
  })
  @ApiResponse({ status: 200, description: "Returns role-safe talent dashboard overview" })
  async getDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.talentsService.getTalentDashboard(currentUser);
  }
}
