import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { NoticeParty, UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { PlacementsService } from "../placements.service";
import { PlacementReviewsService } from "../placement-reviews.service";
import { TrialDecisionDto } from "../dto/trial-decision.dto";
import { GiveNoticeDto } from "../dto/give-notice.dto";
import { CreateBuyoutQuoteDto } from "../dto/create-buyout-quote.dto";
import { QueryPlacementsDto } from "../dto/query-placements.dto";

@ApiTags("Client / Placements")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.client_admin, UserRole.client_user)
@Controller("client/placements")
export class ClientPlacementsController {
  constructor(
    @Inject(PlacementsService) private readonly placementsService: PlacementsService,
    @Inject(PlacementReviewsService) private readonly reviewsService: PlacementReviewsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List active team members (My Team) - FR-SEC-02 hides pay and margin" })
  async findAll(
    @Query() query: QueryPlacementsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.findAll(query, currentUser);
  }

  @Get(":id")
  @ApiOperation({ summary: "View placement details for a team member" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.placementsService.findById(id, currentUser);
  }

  @Post(":id/trial-decision")
  @ApiOperation({ summary: "Submit Keep or Replace decision during trial (FR-PLC-01)" })
  async recordTrialDecision(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TrialDecisionDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reviewsService.recordTrialDecision(id, dto, currentUser);
  }

  @Post(":id/notice")
  @ApiOperation({ summary: "Initiate 30-day notice for a team member" })
  async giveNotice(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: GiveNoticeDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    dto.noticeParty = NoticeParty.client;
    return this.reviewsService.giveNotice(id, dto, currentUser);
  }

  @Post(":id/buyout")
  @ApiOperation({ summary: "Request buyout quote for a team member (FR-PLC-04)" })
  async requestBuyout(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateBuyoutQuoteDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.reviewsService.createBuyoutQuote(id, dto, currentUser);
  }
}

