import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { UserRole } from "../../../generated/prisma/client";
import { AuditDashboardService } from "../audit-dashboard.service";
import { QueryAuditDto } from "../dto/query-audit.dto";
import { QueryStatusHistoryDto } from "../dto/query-status-history.dto";

@ApiTags("Admin / Audit & Dashboard")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(
  UserRole.recruiter,
  UserRole.recruiter_lead,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.finance,
  UserRole.super_admin,
)
@Controller("admin")
export class AuditDashboardController {
  constructor(private readonly service: AuditDashboardService) {}

  @Get("audit-log")
  listAudit(@Query() query: QueryAuditDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listAudit(query, user);
  }

  @Get("status-history")
  listStatusHistory(@Query() query: QueryStatusHistoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listStatusHistory(query, user);
  }

  @Get("dashboard")
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getDashboard(user);
  }
}
