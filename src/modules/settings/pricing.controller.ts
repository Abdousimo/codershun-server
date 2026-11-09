import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { UserRole } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../../common/guards/access-token.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { PricingService } from "./pricing.service";
import {
  CalculateBuyoutDto,
  CalculatePricingDto,
} from "./dto/calculate-pricing.dto";
import { BuyoutResultDto, PricingResultDto } from "./dto/pricing-result.dto";

@ApiTags("Pricing")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller("pricing")
export class PricingController {
  constructor(@Inject(PricingService) private readonly pricingService: PricingService) {}

  @Get("rate-card/current")
  @Roles(
    UserRole.super_admin,
    UserRole.finance,
    UserRole.sales,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.account_manager,
  )
  @ApiOperation({ summary: "Get current active rate card with entries" })
  async getCurrentRateCard() {
    return this.pricingService.getCurrentRateCardVersion();
  }

  @Post("calculate")
  @Roles(
    UserRole.super_admin,
    UserRole.finance,
    UserRole.sales,
    UserRole.recruiter,
    UserRole.recruiter_lead,
    UserRole.account_manager,
  )
  @ApiOperation({
    summary: "Simulate pricing for a placement or quote (FR-PRICE-01, FR-PRICE-04)",
  })
  @ApiResponse({ status: 200, type: PricingResultDto })
  async calculatePricing(@Body() dto: CalculatePricingDto): Promise<PricingResultDto> {
    return this.pricingService.calculatePricing(dto);
  }

  @Post("buyout")
  @Roles(
    UserRole.super_admin,
    UserRole.finance,
    UserRole.sales,
    UserRole.account_manager,
  )
  @ApiOperation({ summary: "Calculate buyout fee according to tier schedule" })
  @ApiResponse({ status: 200, type: BuyoutResultDto })
  async calculateBuyout(@Body() dto: CalculateBuyoutDto): Promise<BuyoutResultDto> {
    return this.pricingService.calculateBuyout(dto);
  }
}
