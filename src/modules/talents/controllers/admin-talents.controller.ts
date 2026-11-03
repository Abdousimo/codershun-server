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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { TalentsService } from "../talents.service";
import { QueryTalentsDto } from "../dto/query-talents.dto";
import {
  ApproveTalentDto,
  BlacklistTalentDto,
  CreateTalentProfileDto,
  RejectTalentDto,
  UpdateTalentProfileDto,
  UpdateTalentStageDto,
} from "../dto/talent-profile.dto";
import { CreateScorecardDto } from "../dto/scorecard.dto";
import {
  CreateCertificationDto,
  CreateEducationDto,
  CreateExperienceDto,
  CreatePortfolioDto,
} from "../dto/experience-education.dto";
import { TalentAdminResponseDto } from "../dto/talent-response.dto";

@ApiTags("Admin Talents (ATS)")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("admin/talents")
export class AdminTalentsController {
  constructor(private readonly talentsService: TalentsService) {}

  @Get()
  @Roles(
    UserRole.super_admin,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.sales,
    UserRole.finance,
  )
  @ApiOperation({ summary: "List candidates in vetting pipeline" })
  @ApiResponse({ status: 200, type: [TalentAdminResponseDto] })
  async getTalents(@Query() query: QueryTalentsDto) {
    return this.talentsService.getTalents(query);
  }

  @Get("kanban")
  @Roles(
    UserRole.super_admin,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.sales,
    UserRole.finance,
  )
  @ApiOperation({ summary: "Get candidates grouped by vetting stage for ATS Kanban board" })
  async getTalentsKanban() {
    return this.talentsService.getTalentsKanban();
  }

  @Get(":id")
  @Roles(
    UserRole.super_admin,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.sales,
    UserRole.finance,
  )
  @ApiOperation({ summary: "Get full candidate profile with vetting timeline and scorecards" })
  async getTalentById(@Param("id") id: string) {
    return this.talentsService.getTalentById(id);
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Create candidate profile" })
  @ApiResponse({ status: 201, type: TalentAdminResponseDto })
  async createTalent(
    @Body() dto: CreateTalentProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TalentAdminResponseDto> {
    return this.talentsService.createTalent(dto, user);
  }

  @Patch(":id")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Update candidate profile" })
  @ApiResponse({ status: 200, type: TalentAdminResponseDto })
  async updateTalent(
    @Param("id") id: string,
    @Body() dto: UpdateTalentProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TalentAdminResponseDto> {
    return this.talentsService.updateTalent(id, dto, user);
  }

  @Patch(":id/stage")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Advance candidate to next vetting stage" })
  @ApiResponse({ status: 200, type: TalentAdminResponseDto })
  async changeTalentStage(
    @Param("id") id: string,
    @Body() dto: UpdateTalentStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TalentAdminResponseDto> {
    return this.talentsService.changeTalentStage(id, dto, user);
  }

  @Post(":id/scorecards")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Submit reviewer technical interview scorecard" })
  async submitScorecard(
    @Param("id") id: string,
    @Body() dto: CreateScorecardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.talentsService.submitScorecard(id, dto, user);
  }

  @Patch(":id/approval")
  @Roles(UserRole.super_admin, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Approve candidate as Vetted / Available (CDC §6.1 Step 7)" })
  @ApiResponse({ status: 200, type: TalentAdminResponseDto })
  async approveTalent(
    @Param("id") id: string,
    @Body() dto: ApproveTalentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TalentAdminResponseDto> {
    return this.talentsService.approveTalent(id, dto, user);
  }

  @Patch(":id/reject")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Reject candidate (sets 6-month reapply delay, Rule FR-TAL-03)" })
  @ApiResponse({ status: 200, type: TalentAdminResponseDto })
  async rejectTalent(
    @Param("id") id: string,
    @Body() dto: RejectTalentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TalentAdminResponseDto> {
    return this.talentsService.rejectTalent(id, dto, user);
  }

  @Patch(":id/blacklist")
  @Roles(UserRole.super_admin, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Blacklist candidate" })
  @ApiResponse({ status: 200, type: TalentAdminResponseDto })
  async blacklistTalent(
    @Param("id") id: string,
    @Body() dto: BlacklistTalentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TalentAdminResponseDto> {
    return this.talentsService.blacklistTalent(id, dto, user);
  }

  @Post(":id/experiences")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Add work experience to candidate" })
  async addExperience(
    @Param("id") id: string,
    @Body() dto: CreateExperienceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.talentsService.addExperience(id, dto, user);
  }

  @Post(":id/educations")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Add education to candidate" })
  async addEducation(
    @Param("id") id: string,
    @Body() dto: CreateEducationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.talentsService.addEducation(id, dto, user);
  }

  @Post(":id/certifications")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Add certification to candidate" })
  async addCertification(
    @Param("id") id: string,
    @Body() dto: CreateCertificationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.talentsService.addCertification(id, dto, user);
  }

  @Post(":id/portfolio")
  @Roles(UserRole.super_admin, UserRole.recruiter, UserRole.recruiter_lead)
  @ApiOperation({ summary: "Add portfolio item to candidate" })
  async addPortfolio(
    @Param("id") id: string,
    @Body() dto: CreatePortfolioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.talentsService.addPortfolioItem(id, dto, user);
  }
}
