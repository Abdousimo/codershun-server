import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { UserRole } from "../../generated/prisma/client";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AccessTokenGuard } from "../../common/guards/access-token.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { SettingsService } from "./settings.service";
import {
  CreateJobCategoryDto,
  CreateJobRoleDto,
  CreateLanguageDto,
  CreatePublicHolidayDto,
  CreateSkillDto,
  CreateTagDto,
  CreateWorkCalendarDto,
} from "./dto/taxonomy.dto";

@ApiTags("Reference Data")
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("reference")
export class ReferenceDataController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  // ==========================================
  // PUBLIC TAXONOMIES
  // ==========================================

  @Public()
  @Get("job-categories")
  @ApiOperation({ summary: "Get job categories and active roles (Public)" })
  async getJobCategories() {
    return this.settingsService.getJobCategories();
  }

  @Public()
  @Get("skills")
  @ApiOperation({ summary: "List skills (Public, filterable by category and search)" })
  async getSkills(
    @Query("categoryId") categoryId?: string,
    @Query("search") search?: string,
  ) {
    return this.settingsService.getSkills(categoryId, search);
  }

  @Public()
  @Get("languages")
  @ApiOperation({ summary: "List spoken languages (Public)" })
  async getLanguages() {
    return this.settingsService.getLanguages();
  }

  @Public()
  @Get("currencies")
  @ApiOperation({ summary: "List supported currencies (Public)" })
  async getCurrencies() {
    return this.settingsService.getCurrencies();
  }

  // ==========================================
  // STAFF REFERENCE DATA
  // ==========================================

  @ApiBearerAuth()
  @Roles(
    UserRole.super_admin,
    UserRole.finance,
    UserRole.sales,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.account_manager,
  )
  @Get("tags")
  @ApiOperation({ summary: "List tags filterable by scope (Staff)" })
  async getTags(@Query("scope") scope?: string) {
    return this.settingsService.getTags(scope);
  }

  @ApiBearerAuth()
  @Roles(
    UserRole.super_admin,
    UserRole.finance,
    UserRole.sales,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.account_manager,
  )
  @Get("calendars")
  @ApiOperation({ summary: "List work calendars and holidays (Staff)" })
  async getWorkCalendars() {
    return this.settingsService.getWorkCalendars();
  }

  // ==========================================
  // ADMIN TAXONOMY CREATION
  // ==========================================

  @ApiBearerAuth()
  @Roles(UserRole.super_admin)
  @Post("job-categories")
  @ApiOperation({ summary: "Create a job category (Super Admin)" })
  async createJobCategory(
    @Body() dto: CreateJobCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createJobCategory(dto, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.super_admin)
  @Post("job-roles")
  @ApiOperation({ summary: "Create a job role (Super Admin)" })
  async createJobRole(
    @Body() dto: CreateJobRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createJobRole(dto, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.super_admin)
  @Post("skills")
  @ApiOperation({ summary: "Create a skill (Super Admin)" })
  async createSkill(
    @Body() dto: CreateSkillDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createSkill(dto, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.super_admin)
  @Post("languages")
  @ApiOperation({ summary: "Add a language (Super Admin)" })
  async createLanguage(
    @Body() dto: CreateLanguageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createLanguage(dto, user);
  }

  @ApiBearerAuth()
  @Roles(
    UserRole.super_admin,
    UserRole.finance,
    UserRole.sales,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.account_manager,
  )
  @Post("tags")
  @ApiOperation({ summary: "Create a tag (Staff)" })
  async createTag(
    @Body() dto: CreateTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createTag(dto, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.super_admin)
  @Post("calendars")
  @ApiOperation({ summary: "Create a work calendar (Super Admin)" })
  async createWorkCalendar(
    @Body() dto: CreateWorkCalendarDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createWorkCalendar(dto, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.super_admin)
  @Post("calendars/:id/holidays")
  @ApiOperation({ summary: "Add a public holiday to calendar (Super Admin)" })
  async addPublicHoliday(
    @Param("id") calendarId: string,
    @Body() dto: CreatePublicHolidayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.addPublicHoliday(calendarId, dto, user);
  }
}
