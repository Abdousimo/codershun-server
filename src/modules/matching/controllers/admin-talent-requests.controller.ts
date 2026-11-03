import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { TalentRequestsService } from "../talent-requests.service";
import { MatchingService } from "../matching.service";
import { CreateTalentRequestDto } from "../dto/create-talent-request.dto";
import {
  UpdateTalentRequestDto,
  UpdateTalentRequestStatusDto,
} from "../dto/update-talent-request.dto";
import { QueryTalentRequestsDto } from "../dto/query-talent-requests.dto";

@ApiTags("Admin / Talent Requests")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(
  UserRole.super_admin,
  UserRole.recruiter_lead,
  UserRole.recruiter,
  UserRole.sales,
  UserRole.account_manager,
)
@Controller("admin/talent-requests")
export class AdminTalentRequestsController {
  constructor(
    private readonly talentRequestsService: TalentRequestsService,
    private readonly matchingService: MatchingService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List talent requests with SLA countdown and status filters" })
  async findAll(
    @Query() query: QueryTalentRequestsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.findAll(query, currentUser);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get detailed talent request by ID" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.findById(id, currentUser);
  }

  @Post()
  @ApiOperation({ summary: "Create a new talent request on behalf of a company" })
  async create(
    @Body() dto: CreateTalentRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.createRequest(dto, currentUser);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update talent request details or assigned recruiter" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTalentRequestDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.updateRequest(id, dto, currentUser);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Update talent request status (requires lostReason if lost - FR-REQ-02)" })
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTalentRequestStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.talentRequestsService.updateStatus(id, dto, currentUser);
  }

  @Get(":id/candidates")
  @ApiOperation({ summary: "Run matching algorithm to find and score vetted candidates (CDC §11.2)" })
  async matchCandidates(@Param("id", ParseUUIDPipe) id: string) {
    return this.matchingService.findMatchesForRequest(id);
  }
}
