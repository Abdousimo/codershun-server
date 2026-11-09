import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { UserRole } from "../../generated/prisma/client";
import { AccessTokenGuard } from "../../common/guards/access-token.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { SettingsService } from "./settings.service";
import {
  CreateCurrencyDto,
  CreateFxRateDto,
  CreateLegalEntityDto,
  UpdateLegalEntityDto,
  UpdateSettingDto,
} from "./dto/settings-and-legal-entity.dto";
import {
  CreateRateCardEntryDto,
  CreateRateCardVersionDto,
  UpdateRateCardEntryDto,
  UpdateRateCardVersionDto,
} from "./dto/rate-card.dto";
import {
  CreateBuyoutTierDto,
  CreateDiscountRuleDto,
  CreateReferralRewardRuleDto,
  UpdateBuyoutTierDto,
  UpdateDiscountRuleDto,
  UpdateReferralRewardRuleDto,
} from "./dto/discount-buyout-referral.dto";

@ApiTags("Admin Settings")
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.super_admin, UserRole.finance)
@Controller("admin/settings")
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  // ==========================================
  // GENERAL SETTINGS
  // ==========================================

  @Get()
  @ApiOperation({ summary: "List all system settings" })
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Get(":key")
  @ApiOperation({ summary: "Get specific setting by key" })
  async getSettingByKey(@Param("key") key: string) {
    return this.settingsService.getSettingByKey(key);
  }

  @Patch(":key")
  @ApiOperation({ summary: "Update setting (Finance allowed for pricing keys only; Super Admin for all)" })
  async updateSetting(
    @Param("key") key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateSetting(key, dto, user);
  }

  // ==========================================
  // LEGAL ENTITIES
  // ==========================================

  @Get("entities/all")
  @ApiOperation({ summary: "List legal entities" })
  async getLegalEntities() {
    return this.settingsService.getLegalEntities();
  }

  @Get("entities/:id")
  @ApiOperation({ summary: "Get legal entity by ID" })
  async getLegalEntityById(@Param("id") id: string) {
    return this.settingsService.getLegalEntityById(id);
  }

  @Post("entities")
  @ApiOperation({ summary: "Create legal entity" })
  async createLegalEntity(
    @Body() dto: CreateLegalEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createLegalEntity(dto, user);
  }

  @Patch("entities/:id")
  @ApiOperation({ summary: "Update legal entity" })
  async updateLegalEntity(
    @Param("id") id: string,
    @Body() dto: UpdateLegalEntityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateLegalEntity(id, dto, user);
  }

  // ==========================================
  // CURRENCIES & FX
  // ==========================================

  @Get("currencies/all")
  @ApiOperation({ summary: "List all supported currencies" })
  async getCurrencies() {
    return this.settingsService.getCurrencies();
  }

  @Post("currencies")
  @ApiOperation({ summary: "Add a supported currency" })
  async createCurrency(
    @Body() dto: CreateCurrencyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createCurrency(dto, user);
  }

  @Get("fx-rates/list")
  @ApiOperation({ summary: "List recorded FX exchange rates" })
  async getFxRates(
    @Query("baseCurrency") baseCurrency?: string,
    @Query("quoteCurrency") quoteCurrency?: string,
  ) {
    return this.settingsService.getFxRates(baseCurrency, quoteCurrency);
  }

  @Post("fx-rates")
  @ApiOperation({ summary: "Record an FX exchange rate" })
  async createFxRate(
    @Body() dto: CreateFxRateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createFxRate(dto, user);
  }

  // ==========================================
  // RATE CARDS
  // ==========================================

  @Get("rate-cards/versions")
  @ApiOperation({ summary: "List rate card versions" })
  async getRateCardVersions() {
    return this.settingsService.getRateCardVersions();
  }

  @Post("rate-cards/versions")
  @ApiOperation({ summary: "Create a new rate card version (FR-PRICE-03)" })
  async createRateCardVersion(
    @Body() dto: CreateRateCardVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createRateCardVersion(dto, user);
  }

  @Patch("rate-cards/versions/:id")
  @ApiOperation({ summary: "Update a rate card version" })
  async updateRateCardVersion(
    @Param("id") id: string,
    @Body() dto: UpdateRateCardVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateRateCardVersion(id, dto, user);
  }

  @Patch("rate-cards/versions/:id/activate")
  @ApiOperation({ summary: "Activate a rate card version as current" })
  async activateRateCardVersion(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.activateRateCardVersion(id, user);
  }

  @Post("rate-cards/versions/:id/entries")
  @ApiOperation({ summary: "Add entry to a rate card version" })
  async createRateCardEntry(
    @Param("id") versionId: string,
    @Body() dto: CreateRateCardEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createRateCardEntry(versionId, dto, user);
  }

  @Patch("rate-cards/entries/:id")
  @ApiOperation({ summary: "Update a rate card entry" })
  async updateRateCardEntry(
    @Param("id") entryId: string,
    @Body() dto: UpdateRateCardEntryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateRateCardEntry(entryId, dto, user);
  }

  // ==========================================
  // DISCOUNTS, BUYOUT, REFERRAL RULES
  // ==========================================

  @Get("rules/discounts")
  @ApiOperation({ summary: "List discount rules" })
  async getDiscountRules() {
    return this.settingsService.getDiscountRules();
  }

  @Post("rules/discounts")
  @ApiOperation({ summary: "Create a discount rule" })
  async createDiscountRule(
    @Body() dto: CreateDiscountRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createDiscountRule(dto, user);
  }

  @Patch("rules/discounts/:id")
  @ApiOperation({ summary: "Update a discount rule" })
  async updateDiscountRule(
    @Param("id") id: string,
    @Body() dto: UpdateDiscountRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateDiscountRule(id, dto, user);
  }

  @Get("rules/buyout-tiers")
  @ApiOperation({ summary: "List buyout tiers" })
  async getBuyoutTiers() {
    return this.settingsService.getBuyoutTiers();
  }

  @Post("rules/buyout-tiers")
  @ApiOperation({ summary: "Create a buyout tier" })
  async createBuyoutTier(
    @Body() dto: CreateBuyoutTierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createBuyoutTier(dto, user);
  }

  @Patch("rules/buyout-tiers/:id")
  @ApiOperation({ summary: "Update a buyout tier" })
  async updateBuyoutTier(
    @Param("id") id: string,
    @Body() dto: UpdateBuyoutTierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateBuyoutTier(id, dto, user);
  }

  @Get("rules/referrals")
  @ApiOperation({ summary: "List referral reward rules" })
  async getReferralRewardRules() {
    return this.settingsService.getReferralRewardRules();
  }

  @Post("rules/referrals")
  @ApiOperation({ summary: "Create a referral reward rule" })
  async createReferralRewardRule(
    @Body() dto: CreateReferralRewardRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.createReferralRewardRule(dto, user);
  }

  @Patch("rules/referrals/:id")
  @ApiOperation({ summary: "Update a referral reward rule" })
  async updateReferralRewardRule(
    @Param("id") id: string,
    @Body() dto: UpdateReferralRewardRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateReferralRewardRule(id, dto, user);
  }
}
