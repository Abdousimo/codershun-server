import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { CrmService } from "../crm.service";

@ApiTags("Client / Dashboard")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user, UserRole.super_admin)
@Controller("client/dashboard")
export class ClientDashboardController {
  constructor(@Inject(CrmService) private readonly crmService: CrmService) {}

  @Get()
  @ApiOperation({
    summary: "Get aggregated dashboard metrics for client company (team, requests, timesheets, invoices)",
  })
  @ApiResponse({ status: 200, description: "Returns company dashboard metrics with confidential pricing isolation" })
  async getDashboard(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.crmService.getClientDashboard(currentUser);
  }
}

