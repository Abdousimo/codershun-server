import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { ReferralsService } from "../referrals.service";
import { CreateReferralDto } from "../dto/create-referral.dto";
import { CreateRewardDto } from "../dto/create-reward.dto";
import { MarkRewardPayableDto } from "../dto/mark-reward-payable.dto";
import { PayRewardDto } from "../dto/pay-reward.dto";
import { QueryReferralsDto } from "../dto/query-referrals.dto";

@ApiTags("Admin / Referrals")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("admin/referrals")
export class AdminReferralsController {
  constructor(@Inject(ReferralsService) private readonly referralsService: ReferralsService) {}

  @Get()
  @ApiOperation({ summary: "List referrals and reward statuses" })
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager, UserRole.recruiter_lead, UserRole.recruiter, UserRole.finance)
  findAll(@Query() query: QueryReferralsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.findAll(query, user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get referral details and rewards" })
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager, UserRole.recruiter_lead, UserRole.recruiter, UserRole.finance)
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.findById(id, user);
  }

  @Post()
  @ApiOperation({ summary: "Create a referral attribution" })
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  create(@Body() dto: CreateReferralDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.create(dto, user);
  }

  @Patch(":id/contacted")
  @ApiOperation({ summary: "Mark a referral as contacted" })
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  markContacted(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markContacted(id, user);
  }

  @Patch(":id/won")
  @ApiOperation({ summary: "Mark a referral as won" })
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  markWon(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markWon(id, user);
  }

  @Patch(":id/lost")
  @ApiOperation({ summary: "Mark a referral as lost" })
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  markLost(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markLost(id, user);
  }

  @Post(":id/rewards")
  @ApiOperation({ summary: "Create a reward for a won referral" })
  @Roles(UserRole.super_admin, UserRole.finance, UserRole.sales, UserRole.account_manager)
  createReward(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateRewardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.createReward(id, dto, user);
  }

  @Patch("rewards/:rewardId/payable")
  @ApiOperation({ summary: "Mark a reward payable after eligibility checks" })
  @Roles(UserRole.super_admin, UserRole.finance)
  markRewardPayable(@Param("rewardId", ParseUUIDPipe) rewardId: string, @Body() dto: MarkRewardPayableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markRewardPayable(rewardId, dto, user);
  }

  @Patch("rewards/:rewardId/paid")
  @ApiOperation({ summary: "Record payment of a referral reward" })
  @Roles(UserRole.super_admin, UserRole.finance)
  payReward(@Param("rewardId", ParseUUIDPipe) rewardId: string, @Body() dto: PayRewardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.payReward(rewardId, dto, user);
  }

  @Patch("rewards/:rewardId/cancel")
  @ApiOperation({ summary: "Cancel a referral reward" })
  @Roles(UserRole.super_admin, UserRole.finance)
  cancelReward(@Param("rewardId", ParseUUIDPipe) rewardId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.cancelReward(rewardId, user);
  }
}
