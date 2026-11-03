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
import { PlacementsService } from "../placements.service";
import { PlacementReviewsService } from "../placement-reviews.service";
import { PlacementOnboardingService } from "../placement-onboarding.service";
import { CreatePlacementDto } from "../dto/create-placement.dto";
import { UpdatePlacementDto } from "../dto/update-placement.dto";
import { TransitionPlacementStatusDto } from "../dto/transition-status.dto";
import { TrialDecisionDto } from "../dto/trial-decision.dto";
import { GiveNoticeDto } from "../dto/give-notice.dto";
import { CreateBuyoutQuoteDto } from "../dto/create-buyout-quote.dto";
import { UpdateOnboardingItemDto } from "../dto/onboarding-item.dto";
import { CreateCheckInDto } from "../dto/check-in.dto";
import { QueryPlacementsDto } from "../dto/query-placements.dto";

@ApiTags("Admin / Placements")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(
  UserRole.super_admin,
  UserRole.recruiter_lead,
  UserRole.recruiter,
  UserRole.sales,
  UserRole.account_manager,
  UserRole.finance,
)
@Controller("admin/placements")
export class AdminPlacementsController {
  constructor(
    private readonly placementsService: PlacementsService,
    private readonly reviewsService: PlacementReviewsService,
    private readonly onboardingService: PlacementOnboardingService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List placements with filters, search, and pagination" })
  async findAll(
    @Query() query: QueryPlacementsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.findAll(query, currentUser);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get detailed placement including financials and checklist" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.findById(id, currentUser);
  }

  @Post()
  @ApiOperation({ summary: "Create a placement (FR-PRICE-01..04, FR-TAL-02)" })
  async create(
    @Body() dto: CreatePlacementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.createPlacement(dto, currentUser);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update placement details (prices frozen once signed - FR-PRICE-03)" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlacementDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.updatePlacement(id, dto, currentUser);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Transition placement status according to allowed transitions" })
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TransitionPlacementStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.transitionStatus(id, dto, currentUser);
  }

  @Post(":id/trial-decision")
  @ApiOperation({ summary: "Record Keep or Replace decision at end of trial (FR-PLC-01, FR-PLC-02)" })
  async recordTrialDecision(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TrialDecisionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reviewsService.recordTrialDecision(id, dto, currentUser);
  }

  @Post(":id/notice")
  @ApiOperation({ summary: "Initiate notice period (FR-PLC-01)" })
  async giveNotice(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GiveNoticeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reviewsService.giveNotice(id, dto, currentUser);
  }

  @Post(":id/buyout-quote")
  @ApiOperation({ summary: "Generate buyout quote based on buyout_tiers (FR-PLC-04)" })
  async createBuyoutQuote(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateBuyoutQuoteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reviewsService.createBuyoutQuote(id, dto, currentUser);
  }

  @Patch(":id/onboarding/:itemId")
  @ApiOperation({ summary: "Update status of an onboarding checklist item" })
  async updateOnboardingItem(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateOnboardingItemDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.onboardingService.updateOnboardingItem(id, itemId, dto.isDone, currentUser);
  }

  @Post(":id/check-ins")
  @ApiOperation({ summary: "Record periodic check-in score (1 to 5) and auto-flag risk" })
  async recordCheckIn(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateCheckInDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reviewsService.recordCheckIn(id, dto, currentUser);
  }
}
