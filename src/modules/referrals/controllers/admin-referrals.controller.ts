import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager, UserRole.recruiter_lead, UserRole.recruiter, UserRole.finance)
  findAll(@Query() query: QueryReferralsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.findAll(query, user);
  }

  @Get(":id")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager, UserRole.recruiter_lead, UserRole.recruiter, UserRole.finance)
  findOne(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.findById(id, user);
  }

  @Post()
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  create(@Body() dto: CreateReferralDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.create(dto, user);
  }

  @Patch(":id/contacted")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  markContacted(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markContacted(id, user);
  }

  @Patch(":id/won")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  markWon(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markWon(id, user);
  }

  @Patch(":id/lost")
  @Roles(UserRole.super_admin, UserRole.sales, UserRole.account_manager)
  markLost(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markLost(id, user);
  }

  @Post(":id/rewards")
  @Roles(UserRole.super_admin, UserRole.finance, UserRole.sales, UserRole.account_manager)
  createReward(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateRewardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.createReward(id, dto, user);
  }

  @Patch("rewards/:rewardId/payable")
  @Roles(UserRole.super_admin, UserRole.finance)
  markRewardPayable(@Param("rewardId", ParseUUIDPipe) rewardId: string, @Body() dto: MarkRewardPayableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.markRewardPayable(rewardId, dto, user);
  }

  @Patch("rewards/:rewardId/paid")
  @Roles(UserRole.super_admin, UserRole.finance)
  payReward(@Param("rewardId", ParseUUIDPipe) rewardId: string, @Body() dto: PayRewardDto, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.payReward(rewardId, dto, user);
  }

  @Patch("rewards/:rewardId/cancel")
  @Roles(UserRole.super_admin, UserRole.finance)
  cancelReward(@Param("rewardId", ParseUUIDPipe) rewardId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.cancelReward(rewardId, user);
  }
}
