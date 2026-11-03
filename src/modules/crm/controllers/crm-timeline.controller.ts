import {
  Body,
  Controller,
  Get,
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
import {
  CreateNoteDto,
  CreateTaskDto,
  UpdateTaskDto,
} from "../dto/timeline.dto";

@ApiTags("CRM Timeline")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("crm")
export class CrmTimelineController {
  constructor(private readonly crmService: CrmService) {}

  @Get("notes")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "Get notes for an entity (lead, company, etc.)" })
  async getNotes(
    @Query("entityType") entityType: string,
    @Query("entityId") entityId: string,
  ) {
    return this.crmService.getNotes(entityType, entityId);
  }

  @Post("notes")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
  )
  @ApiOperation({ summary: "Add a note to an entity" })
  async createNote(
    @Body() dto: CreateNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.createNote(dto, user);
  }

  @Get("tasks")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.finance,
  )
  @ApiOperation({ summary: "List CRM tasks" })
  async getTasks(
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
    @Query("assigneeId") assigneeId?: string,
  ) {
    return this.crmService.getTasks(entityType, entityId, assigneeId);
  }

  @Post("tasks")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
  )
  @ApiOperation({ summary: "Create a CRM task" })
  async createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.createTask(dto, user);
  }

  @Patch("tasks/:id")
  @Roles(
    UserRole.super_admin,
    UserRole.sales,
    UserRole.account_manager,
    UserRole.recruiter,
    UserRole.recruiter_lead,
  )
  @ApiOperation({ summary: "Update task or mark as completed" })
  async updateTask(
    @Param("id") id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crmService.updateTask(id, dto, user);
  }
}

