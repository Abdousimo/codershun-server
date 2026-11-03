import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { Prisma, UserRole } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { toDecimal } from "../../common/utils/money";
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
import {
  CreateJobCategoryDto,
  CreateJobRoleDto,
  CreateLanguageDto,
  CreatePublicHolidayDto,
  CreateSkillDto,
  CreateTagDto,
  CreateWorkCalendarDto,
} from "./dto/taxonomy.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // SETTINGS (KEY-VALUE)
  // ==========================================

  async getAllSettings() {
    return this.prisma.settings.findMany({
      orderBy: { key: "asc" },
    });
  }

  async getSettingByKey(key: string) {
    const setting = await this.prisma.settings.findUnique({
      where: { key },
    });
    if (!setting) {
      throw new NotFoundException(`Setting with key '${key}' not found`);
    }
    return setting;
  }

  async updateSetting(key: string, dto: UpdateSettingDto, currentUser: AuthenticatedUser) {
    // Permission check (CDC 11.3): Finance edits pricing settings only; Super Admin edits all.
    if (currentUser.role === UserRole.finance && !this.isPricingSettingKey(key)) {
      throw new ForbiddenException("Finance role can only edit pricing-related settings");
    }

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.settings.upsert({
        where: { key },
        create: {
          key,
          value: dto.value as Prisma.InputJsonValue,
          description: dto.description,
          updatedBy: currentUser.id,
        },
        update: {
          value: dto.value as Prisma.InputJsonValue,
          ...(dto.description !== undefined && { description: dto.description }),
          updatedBy: currentUser.id,
          updatedAt: new Date(),
        },
      });
    });
  }

  private isPricingSettingKey(key: string): boolean {
    const pricingPrefixes = ["pricing", "rate_card", "margin", "discount", "buyout", "referral", "vat", "billing", "currency"];
    return pricingPrefixes.some((prefix) => key.startsWith(prefix));
  }

  // ==========================================
  // LEGAL ENTITIES
  // ==========================================

  async getLegalEntities() {
    return this.prisma.legalEntities.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async getLegalEntityById(id: string) {
    const entity = await this.prisma.legalEntities.findUnique({
      where: { id },
    });
    if (!entity) {
      throw new NotFoundException(`Legal entity ${id} not found`);
    }
    return entity;
  }

  async createLegalEntity(dto: CreateLegalEntityDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.legalEntities.create({
        data: {
          name: dto.name,
          legalForm: dto.legalForm,
          countryCode: dto.countryCode,
          registrationNumber: dto.registrationNumber,
          taxId: dto.taxId,
          address: dto.address,
          bankName: dto.bankName,
          iban: dto.iban,
          swiftBic: dto.swiftBic,
          payoneerAccount: dto.payoneerAccount,
          defaultCurrency: dto.defaultCurrency,
          invoicePrefix: dto.invoicePrefix,
          creditNotePrefix: dto.creditNotePrefix ?? "CN",
          taxMentions: (dto.taxMentions ?? {}) as Prisma.InputJsonValue,
          defaultVatRate: dto.defaultVatRate ? toDecimal(dto.defaultVatRate) : toDecimal("0.00"),
          acceptsCardPayments: dto.acceptsCardPayments ?? false,
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  async updateLegalEntity(id: string, dto: UpdateLegalEntityDto, currentUser: AuthenticatedUser) {
    await this.getLegalEntityById(id);

    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.legalEntities.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.legalForm !== undefined && { legalForm: dto.legalForm }),
          ...(dto.countryCode !== undefined && { countryCode: dto.countryCode }),
          ...(dto.registrationNumber !== undefined && { registrationNumber: dto.registrationNumber }),
          ...(dto.taxId !== undefined && { taxId: dto.taxId }),
          ...(dto.address !== undefined && { address: dto.address }),
          ...(dto.bankName !== undefined && { bankName: dto.bankName }),
          ...(dto.iban !== undefined && { iban: dto.iban }),
          ...(dto.swiftBic !== undefined && { swiftBic: dto.swiftBic }),
          ...(dto.payoneerAccount !== undefined && { payoneerAccount: dto.payoneerAccount }),
          ...(dto.defaultCurrency !== undefined && { defaultCurrency: dto.defaultCurrency }),
          ...(dto.invoicePrefix !== undefined && { invoicePrefix: dto.invoicePrefix }),
          ...(dto.creditNotePrefix !== undefined && { creditNotePrefix: dto.creditNotePrefix }),
          ...(dto.taxMentions !== undefined && { taxMentions: dto.taxMentions as Prisma.InputJsonValue }),
          ...(dto.defaultVatRate !== undefined && { defaultVatRate: toDecimal(dto.defaultVatRate) }),
          ...(dto.acceptsCardPayments !== undefined && { acceptsCardPayments: dto.acceptsCardPayments }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          updatedAt: new Date(),
        },
      });
    });
  }

  // ==========================================
  // CURRENCIES & FX RATES
  // ==========================================

  async getCurrencies() {
    return this.prisma.currencies.findMany({
      orderBy: { code: "asc" },
    });
  }

  async createCurrency(dto: CreateCurrencyDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.currencies.create({
        data: {
          code: dto.code.toUpperCase(),
          name: dto.name,
          symbol: dto.symbol,
          minorUnits: dto.minorUnits ?? 2,
          isClientCurrency: dto.isClientCurrency ?? true,
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  async getFxRates(baseCurrency?: string, quoteCurrency?: string) {
    return this.prisma.fxRates.findMany({
      where: {
        ...(baseCurrency && { baseCurrency }),
        ...(quoteCurrency && { quoteCurrency }),
      },
      orderBy: { rateDate: "desc" },
      take: 100,
    });
  }

  async createFxRate(dto: CreateFxRateDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.fxRates.create({
        data: {
          baseCurrency: dto.baseCurrency.toUpperCase(),
          quoteCurrency: dto.quoteCurrency.toUpperCase(),
          rate: toDecimal(dto.rate),
          rateDate: new Date(dto.rateDate),
          source: dto.source,
        },
      });
    });
  }

  // ==========================================
  // RATE CARDS & ENTRIES
  // ==========================================

  async getRateCardVersions() {
    return this.prisma.rateCardVersions.findMany({
      orderBy: { validFrom: "desc" },
    });
  }

  async createRateCardVersion(dto: CreateRateCardVersionDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      // If marked as isCurrent, set all other versions to isCurrent = false
      if (dto.isCurrent) {
        await tx.rateCardVersions.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
      }

      return tx.rateCardVersions.create({
        data: {
          label: dto.label,
          validFrom: new Date(dto.validFrom),
          validTo: dto.validTo ? new Date(dto.validTo) : null,
          isCurrent: dto.isCurrent ?? false,
          hoursPerMonth: dto.hoursPerMonth ? toDecimal(dto.hoursPerMonth) : toDecimal("160.00"),
          tmPremiumPct: dto.tmPremiumPct ? toDecimal(dto.tmPremiumPct) : toDecimal("15.00"),
          hoursPerDay: dto.hoursPerDay ? toDecimal(dto.hoursPerDay) : toDecimal("8.00"),
          partTimePricePct: dto.partTimePricePct ? toDecimal(dto.partTimePricePct) : toDecimal("55.00"),
          floorMarginPct: dto.floorMarginPct ? toDecimal(dto.floorMarginPct) : toDecimal("25.00"),
          warningMarginPct: dto.warningMarginPct ? toDecimal(dto.warningMarginPct) : toDecimal("30.00"),
          maxCombinedDiscountPct: dto.maxCombinedDiscountPct ? toDecimal(dto.maxCombinedDiscountPct) : toDecimal("12.00"),
          minDedicatedMonths: dto.minDedicatedMonths ?? 1,
          minTmHours: dto.minTmHours ?? 40,
          createdBy: currentUser.id,
        },
      });
    });
  }

  async updateRateCardVersion(id: string, dto: UpdateRateCardVersionDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.rateCardVersions.update({
        where: { id },
        data: {
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.validTo !== undefined && { validTo: dto.validTo ? new Date(dto.validTo) : null }),
          ...(dto.hoursPerMonth !== undefined && { hoursPerMonth: toDecimal(dto.hoursPerMonth) }),
          ...(dto.tmPremiumPct !== undefined && { tmPremiumPct: toDecimal(dto.tmPremiumPct) }),
          ...(dto.hoursPerDay !== undefined && { hoursPerDay: toDecimal(dto.hoursPerDay) }),
          ...(dto.partTimePricePct !== undefined && { partTimePricePct: toDecimal(dto.partTimePricePct) }),
          ...(dto.floorMarginPct !== undefined && { floorMarginPct: toDecimal(dto.floorMarginPct) }),
          ...(dto.warningMarginPct !== undefined && { warningMarginPct: toDecimal(dto.warningMarginPct) }),
          ...(dto.maxCombinedDiscountPct !== undefined && { maxCombinedDiscountPct: toDecimal(dto.maxCombinedDiscountPct) }),
          ...(dto.minDedicatedMonths !== undefined && { minDedicatedMonths: dto.minDedicatedMonths }),
          ...(dto.minTmHours !== undefined && { minTmHours: dto.minTmHours }),
        },
      });
    });
  }

  async activateRateCardVersion(id: string, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      await tx.rateCardVersions.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });

      return tx.rateCardVersions.update({
        where: { id },
        data: { isCurrent: true },
      });
    });
  }

  /**
   * Note: client_price is generated by PostgreSQL and must NEVER be inserted (AGENTS.md Rule 4).
   */
  async createRateCardEntry(versionId: string, dto: CreateRateCardEntryDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.rateCardEntries.create({
        data: {
          rateCardVersionId: versionId,
          seniority: dto.seniority,
          minYears: dto.minYears,
          maxYears: dto.maxYears,
          talentNetPay: toDecimal(dto.talentNetPay),
          targetMarginPct: toDecimal(dto.targetMarginPct),
          currency: dto.currency ?? "EUR",
        },
      });
    });
  }

  async updateRateCardEntry(entryId: string, dto: UpdateRateCardEntryDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.rateCardEntries.update({
        where: { id: entryId },
        data: {
          ...(dto.minYears !== undefined && { minYears: dto.minYears }),
          ...(dto.maxYears !== undefined && { maxYears: dto.maxYears }),
          ...(dto.talentNetPay !== undefined && { talentNetPay: toDecimal(dto.talentNetPay) }),
          ...(dto.targetMarginPct !== undefined && { targetMarginPct: toDecimal(dto.targetMarginPct) }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
        },
      });
    });
  }

  // ==========================================
  // DISCOUNTS, BUYOUT TIERS, REFERRALS
  // ==========================================

  async getDiscountRules() {
    return this.prisma.discountRules.findMany({
      orderBy: { discountPct: "asc" },
    });
  }

  async createDiscountRule(dto: CreateDiscountRuleDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.discountRules.create({
        data: {
          code: dto.code,
          label: dto.label,
          discountPct: toDecimal(dto.discountPct),
          minTalents: dto.minTalents,
          minCommitmentMonths: dto.minCommitmentMonths,
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  async updateDiscountRule(id: string, dto: UpdateDiscountRuleDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.discountRules.update({
        where: { id },
        data: {
          ...(dto.label !== undefined && { label: dto.label }),
          ...(dto.discountPct !== undefined && { discountPct: toDecimal(dto.discountPct) }),
          ...(dto.minTalents !== undefined && { minTalents: dto.minTalents }),
          ...(dto.minCommitmentMonths !== undefined && { minCommitmentMonths: dto.minCommitmentMonths }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          updatedAt: new Date(),
        },
      });
    });
  }

  async getBuyoutTiers() {
    return this.prisma.buyoutTiers.findMany({
      orderBy: { fromMonth: "asc" },
    });
  }

  async createBuyoutTier(dto: CreateBuyoutTierDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.buyoutTiers.create({
        data: {
          fromMonth: dto.fromMonth,
          toMonth: dto.toMonth,
          multiplier: toDecimal(dto.multiplier),
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  async updateBuyoutTier(id: string, dto: UpdateBuyoutTierDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.buyoutTiers.update({
        where: { id },
        data: {
          ...(dto.fromMonth !== undefined && { fromMonth: dto.fromMonth }),
          ...(dto.toMonth !== undefined && { toMonth: dto.toMonth }),
          ...(dto.multiplier !== undefined && { multiplier: toDecimal(dto.multiplier) }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    });
  }

  async getReferralRewardRules() {
    return this.prisma.referralRewardRules.findMany({
      orderBy: { rewardType: "asc" },
    });
  }

  async createReferralRewardRule(dto: CreateReferralRewardRuleDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.referralRewardRules.create({
        data: {
          rewardType: dto.rewardType,
          baseAmount: toDecimal(dto.baseAmount),
          perExtraTalentAmount: dto.perExtraTalentAmount ? toDecimal(dto.perExtraTalentAmount) : toDecimal("0.00"),
          extraTalentThreshold: dto.extraTalentThreshold,
          currency: dto.currency ?? "EUR",
          paidInvoicesRequired: dto.paidInvoicesRequired ?? 2,
          minClientMonths: dto.minClientMonths ?? 3,
          attributionDays: dto.attributionDays ?? 90,
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  async updateReferralRewardRule(id: string, dto: UpdateReferralRewardRuleDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.referralRewardRules.update({
        where: { id },
        data: {
          ...(dto.baseAmount !== undefined && { baseAmount: toDecimal(dto.baseAmount) }),
          ...(dto.perExtraTalentAmount !== undefined && { perExtraTalentAmount: toDecimal(dto.perExtraTalentAmount) }),
          ...(dto.extraTalentThreshold !== undefined && { extraTalentThreshold: dto.extraTalentThreshold }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.paidInvoicesRequired !== undefined && { paidInvoicesRequired: dto.paidInvoicesRequired }),
          ...(dto.minClientMonths !== undefined && { minClientMonths: dto.minClientMonths }),
          ...(dto.attributionDays !== undefined && { attributionDays: dto.attributionDays }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
    });
  }

  // ==========================================
  // REFERENCE DATA / TAXONOMIES
  // ==========================================

  async getJobCategories() {
    const categories = await this.prisma.jobCategories.findMany({
      orderBy: { sortOrder: "asc" },
    });
    const roles = await this.prisma.jobRoles.findMany({
      where: { isActive: true },
      orderBy: { nameEn: "asc" },
    });

    return categories.map((c) => ({
      ...c,
      roles: roles.filter((r) => r.categoryId === c.id),
    }));
  }

  async createJobCategory(dto: CreateJobCategoryDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.jobCategories.create({
        data: {
          slug: dto.slug,
          nameEn: dto.nameEn,
          nameFr: dto.nameFr,
          nameAr: dto.nameAr,
          isOnRequest: dto.isOnRequest ?? false,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    });
  }

  async createJobRole(dto: CreateJobRoleDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.jobRoles.create({
        data: {
          categoryId: dto.categoryId,
          slug: dto.slug,
          nameEn: dto.nameEn,
          nameFr: dto.nameFr,
          nameAr: dto.nameAr,
          isRareSkill: dto.isRareSkill ?? false,
          skillPremiumPct: dto.skillPremiumPct ? toDecimal(dto.skillPremiumPct) : toDecimal("0.00"),
          isActive: dto.isActive ?? true,
        },
      });
    });
  }

  async getSkills(categoryId?: string, search?: string) {
    return this.prisma.skills.findMany({
      where: {
        ...(categoryId && { categoryId }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { name: "asc" },
      take: 100,
    });
  }

  async createSkill(dto: CreateSkillDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.skills.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          categoryId: dto.categoryId,
          isRare: dto.isRare ?? false,
          premiumPct: dto.premiumPct ? toDecimal(dto.premiumPct) : toDecimal("0.00"),
          aliases: dto.aliases ?? [],
        },
      });
    });
  }

  async getLanguages() {
    return this.prisma.languages.findMany({
      orderBy: { name: "asc" },
    });
  }

  async createLanguage(dto: CreateLanguageDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.languages.create({
        data: {
          code: dto.code.toLowerCase(),
          name: dto.name,
        },
      });
    });
  }

  async getTags(scope?: string) {
    return this.prisma.tags.findMany({
      where: {
        ...(scope && { scope }),
      },
      orderBy: { name: "asc" },
    });
  }

  async createTag(dto: CreateTagDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.tags.create({
        data: {
          name: dto.name,
          scope: dto.scope,
          color: dto.color,
        },
      });
    });
  }

  async getWorkCalendars() {
    const calendars = await this.prisma.workCalendars.findMany({
      orderBy: { name: "asc" },
    });
    const holidays = await this.prisma.publicHolidays.findMany({
      orderBy: { holidayDate: "asc" },
    });

    return calendars.map((cal) => ({
      ...cal,
      holidays: holidays.filter((h) => h.calendarId === cal.id),
    }));
  }

  async createWorkCalendar(dto: CreateWorkCalendarDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.workCalendars.create({
        data: {
          name: dto.name,
          countryCode: dto.countryCode,
          workingDays: dto.workingDays,
        },
      });
    });
  }

  async addPublicHoliday(calendarId: string, dto: CreatePublicHolidayDto, currentUser: AuthenticatedUser) {
    return this.prisma.withUserContext(currentUser, async (tx) => {
      return tx.publicHolidays.create({
        data: {
          calendarId,
          holidayDate: new Date(dto.holidayDate),
          name: dto.name,
        },
      });
    });
  }
}
