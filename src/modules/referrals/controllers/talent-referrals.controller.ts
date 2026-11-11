import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { ReferralsService } from "../referrals.service";
import { SubmitTalentReferralDto } from "../dto/submit-talent-referral.dto";

@ApiTags("Talent / Referrals")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/referrals")
export class TalentReferralsController {
  constructor(@Inject(ReferralsService) private readonly referralsService: ReferralsService) {}

  @Get()
  @ApiOperation({ summary: "Get talent referral profile, unique link, bonus metrics, and referred leads" })
  @ApiResponse({ status: 200, description: "Returns referral profile and bonus ledger" })
  async getProfile(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.referralsService.getTalentReferralProfile(currentUser);
  }

  @Post()
  @ApiOperation({ summary: "Submit a peer or client company referral" })
  @ApiResponse({ status: 201, description: "Referral submitted and eligible for bonus" })
  async submitReferral(
    @Body() dto: SubmitTalentReferralDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.referralsService.submitTalentReferral(dto, currentUser);
  }
}

