import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
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
import { CrmService } from "../crm.service";
import { QueryLeadsDto } from "../dto/query-crm.dto";
import {
  ChangeLeadStageDto,
  CreateLeadDto,
  UpdateLeadDto,
} from "../dto/lead.dto";

@ApiTags("CRM Leads")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("crm/leads")
export class LeadsController {
  constructor(@Inject(CrmService) private readonly crmService: CrmService) {}

  @Get()
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "List leads with pagination and filters" })
  async getLeads(@Query() query: QueryLeadsDto) {
    return this.crmService.getLeads(query);
  }

  @Get("kanban")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "Get leads grouped by stage for Kanban board view" })
  async getLeadsKanban() {
    return this.crmService.getLeadsKanban();
  }

  @Get(":id")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "Get lead by ID with company, contact, notes, and tasks" })
  async getLeadById(@Param("id") id: string) {
    return this.crmService.getLeadById(id);
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Create a lead" })
  async createLead(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.createLead(dto, user);
  }

  @Patch(":id")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Update lead details" })
  async updateLead(
    @Param("id") id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.updateLead(id, dto, user);
  }

  @Patch(":id/stage")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  @ApiOperation({ summary: "Update lead stage (enforces FR-REQ-02: lostReason required when lost)" })
  async changeLeadStage(
    @Param("id") id: string,
    @Body() dto: ChangeLeadStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.changeLeadStage(id, dto, user);
  }
}

