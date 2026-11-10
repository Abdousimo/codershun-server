import {
  Body,
  Controller,
  Get,
  Inject,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "../../../generated/prisma/client";
import { AccessTokenGuard } from "../../../common/guards/access-token.guard";
import { RolesGuard } from "../../../common/guards/roles.guard";
import { Roles } from "../../../common/decorators/roles.decorator";
import { CurrentUser } from "../../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../../common/types/authenticated-user";
import { PayoutsService } from "../payouts.service";

@ApiTags("Talent / Payouts")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.talent, UserRole.super_admin)
@Controller("talent/payouts")
export class TalentPayoutsController {
  constructor(@Inject(PayoutsService) private readonly payoutsService: PayoutsService) {}

  @Get()
  @ApiOperation({ summary: "Get talent earnings, payouts history, and totals" })
  async getPayouts(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.payoutsService.getTalentPayouts(currentUser);
  }

  @Get("method")
  @ApiOperation({ summary: "Get configured payout method and coordinates" })
  async getPayoutMethod(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.payoutsService.getTalentPayoutMethod(currentUser);
  }

  @Patch("method")
  @ApiOperation({ summary: "Update payout method and coordinates" })
  async updatePayoutMethod(
    @Body() body: { payoutMethod: any; payoutCurrency?: string; payoutDetails: Record<string, any> },
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.payoutsService.updateTalentPayoutMethod(body, currentUser);
  }
}
