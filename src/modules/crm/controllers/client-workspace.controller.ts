import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { CrmService } from "../crm.service";

@ApiTags("Client / Workspace")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user, UserRole.super_admin)
@Controller("client/workspace")
export class ClientWorkspaceController {
  constructor(@Inject(CrmService) private readonly crmService: CrmService) {}

  @Get()
  @ApiOperation({ summary: "Get company profile and billing settings" })
  @ApiResponse({ status: 200, description: "Returns company workspace profile" })
  async getWorkspace(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.crmService.getClientWorkspace(currentUser);
  }

  @Patch()
  @ApiOperation({ summary: "Update company profile and billing information" })
  @ApiResponse({ status: 200, description: "Updated company profile" })
  async updateWorkspace(
    @Body()
    body: {
      name?: string;
      billingEmail?: string;
      taxId?: string;
      billingAddress?: string;
      website?: string;
      phone?: string;
    },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.crmService.updateClientWorkspace(body, currentUser);
  }

  @Get("members")
  @ApiOperation({ summary: "List company workspace members and access roles" })
  @ApiResponse({ status: 200, description: "List of workspace members" })
  async getMembers(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.crmService.getClientWorkspaceMembers(currentUser);
  }

  @Post("members/invite")
  @ApiOperation({ summary: "Invite a colleague to company workspace" })
  @ApiResponse({ status: 201, description: "Member invited / created successfully" })
  async inviteMember(
    @Body()
    body: {
      email: string;
      firstName?: string;
      lastName?: string;
      isAdmin?: boolean;
      canViewInvoices?: boolean;
    },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.crmService.inviteClientWorkspaceMember(body, currentUser);
  }
}

