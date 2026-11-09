import "dotenv/config";
import * as argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CompanyStatus,
  Prisma,
  SeniorityLevel,
  UserRole,
  UserStatus,
  VettingStage,
} from "../src/generated/prisma/client";
import { PrismaClient } from "../src/generated/prisma/client";
import { ensureDatabaseViews } from "../scripts/ensure-views";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  await ensureDatabaseViews();
  console.log("Seeding database with standard reference data and test accounts...");

  // 1. Currencies
  const currencies = await Promise.all([
    prisma.currencies.upsert({
      where: { code: "EUR" },
      update: { name: "Euro", symbol: "€", isClientCurrency: true, isActive: true },
      create: { code: "EUR", name: "Euro", symbol: "€", isClientCurrency: true, isActive: true },
    }),
    prisma.currencies.upsert({
      where: { code: "USD" },
      update: { name: "US Dollar", symbol: "$", isClientCurrency: true, isActive: true },
      create: { code: "USD", name: "US Dollar", symbol: "$", isClientCurrency: true, isActive: true },
    }),
    prisma.currencies.upsert({
      where: { code: "GBP" },
      update: { name: "Pound Sterling", symbol: "£", isClientCurrency: true, isActive: true },
      create: { code: "GBP", name: "Pound Sterling", symbol: "£", isClientCurrency: true, isActive: true },
    }),
    prisma.currencies.upsert({
      where: { code: "DZD" },
      update: { name: "Algerian Dinar", symbol: "DA", isClientCurrency: false, isActive: true },
      create: { code: "DZD", name: "Algerian Dinar", symbol: "DA", isClientCurrency: false, isActive: true },
    }),
  ]);
  console.log(`- Seeded ${currencies.length} currencies`);

  // 2. Legal Entity
  const legalEntity = await prisma.legalEntities.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: { name: "Coders Hub SAS", invoicePrefix: "INV-FR", defaultCurrency: "EUR", isActive: true },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Coders Hub SAS",
      legalForm: "SAS",
      countryCode: "FR",
      defaultCurrency: "EUR",
      invoicePrefix: "INV-FR",
      creditNotePrefix: "CN-FR",
      isActive: true,
    },
  });
  console.log(`- Seeded legal entity: ${legalEntity.name}`);

  // 3. Settings
  const defaultSettings = [
    { key: "trial.working_days", value: 10, description: "Trial period in working days" },
    { key: "sla.shortlist_business_hours", value: 48, description: "SLA business hours to produce candidate shortlist" },
    { key: "margin.floor_pct", value: 25.0, description: "Absolute minimum gross margin % floor" },
    { key: "margin.warning_pct", value: 30.0, description: "Margin warning threshold %" },
    { key: "discount.max_combined_pct", value: 12.0, description: "Maximum allowable combined discount %" },
    { key: "billing.payment_terms_days", value: 7, description: "Standard invoice payment due days" },
  ];

  for (const s of defaultSettings) {
    await prisma.settings.upsert({
      where: { key: s.key },
      update: { value: s.value, description: s.description },
      create: { key: s.key, value: s.value, description: s.description },
    });
  }
  console.log(`- Seeded ${defaultSettings.length} platform settings`);

  // 4. Rate Card Version & Entries
  const rateCardVersion = await prisma.rateCardVersions.upsert({
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: { label: "Standard 2026 Rate Card", isCurrent: true },
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      label: "Standard 2026 Rate Card",
      validFrom: new Date("2026-01-01"),
      isCurrent: true,
      hoursPerMonth: new Prisma.Decimal("160"),
      floorMarginPct: new Prisma.Decimal("25.00"),
      warningMarginPct: new Prisma.Decimal("30.00"),
    },
  });

  const rateCardEntries = [
    { seniority: SeniorityLevel.junior, minYears: 1, maxYears: 3, talentNetPay: 800, targetMarginPct: 40, clientPrice: 1333.33 },
    { seniority: SeniorityLevel.mid, minYears: 3, maxYears: 5, talentNetPay: 1200, targetMarginPct: 40, clientPrice: 2000.00 },
    { seniority: SeniorityLevel.senior, minYears: 5, maxYears: 8, talentNetPay: 2000, targetMarginPct: 40, clientPrice: 3333.33 },
    { seniority: SeniorityLevel.lead, minYears: 8, maxYears: 15, talentNetPay: 3000, targetMarginPct: 40, clientPrice: 5000.00 },
  ];

  for (const entry of rateCardEntries) {
    await prisma.rateCardEntries.upsert({
      where: {
        rateCardVersionId_seniority: {
          rateCardVersionId: rateCardVersion.id,
          seniority: entry.seniority,
        },
      },
      update: {
        talentNetPay: new Prisma.Decimal(entry.talentNetPay),
        targetMarginPct: new Prisma.Decimal(entry.targetMarginPct),
        clientPrice: new Prisma.Decimal(entry.clientPrice),
      },
      create: {
        rateCardVersionId: rateCardVersion.id,
        seniority: entry.seniority,
        minYears: entry.minYears,
        maxYears: entry.maxYears,
        talentNetPay: new Prisma.Decimal(entry.talentNetPay),
        targetMarginPct: new Prisma.Decimal(entry.targetMarginPct),
        clientPrice: new Prisma.Decimal(entry.clientPrice),
        currency: "EUR",
      },
    });
  }
  console.log(`- Seeded rate card with ${rateCardEntries.length} seniority entries`);

  // 5. Buyout Tiers
  const buyoutTiers = [
    { fromMonth: 0, toMonth: 6, multiplier: "3.0" },
    { fromMonth: 6, toMonth: 12, multiplier: "2.0" },
    { fromMonth: 12, toMonth: 24, multiplier: "1.0" },
    { fromMonth: 24, toMonth: null, multiplier: "0.0" },
  ];

  for (let i = 0; i < buyoutTiers.length; i++) {
    const tier = buyoutTiers[i];
    const tierId = `00000000-0000-0000-0000-00000000002${i}`;
    await prisma.buyoutTiers.upsert({
      where: { id: tierId },
      update: {
        fromMonth: tier.fromMonth,
        toMonth: tier.toMonth,
        multiplier: new Prisma.Decimal(tier.multiplier),
        isActive: true,
      },
      create: {
        id: tierId,
        fromMonth: tier.fromMonth,
        toMonth: tier.toMonth,
        multiplier: new Prisma.Decimal(tier.multiplier),
        isActive: true,
      },
    });
  }
  console.log(`- Seeded ${buyoutTiers.length} buyout tiers`);

  // 6. Sample Company
  const company = await prisma.companies.upsert({
    where: { id: "00000000-0000-0000-0000-000000000100" },
    update: { name: "Acme Corp", status: CompanyStatus.client },
    create: {
      id: "00000000-0000-0000-0000-000000000100",
      name: "Acme Corp",
      legalName: "Acme Technologies SAS",
      countryCode: "FR",
      industry: "Software & AI",
      currency: "EUR",
      status: CompanyStatus.client,
      legalEntityId: legalEntity.id,
      billingEmail: "billing@acme.test",
    },
  });
  console.log(`- Seeded client company: ${company.name}`);

  // 7. Test Users with standard password: "password123"
  const passwordHash = await argon2.hash("password123");

  const accounts = [
    {
      id: "00000000-0000-0000-0000-000000000002",
      email: "admin@codershub.dz",
      role: UserRole.super_admin,
      firstName: "Admin",
      lastName: "Super",
      status: UserStatus.invited, // Allows direct 1-step login without 2FA challenge
      twoFactorEnabled: false,
      twoFactorRecoveryCodes: [],
    },
    {
      id: "00000000-0000-0000-0000-000000000003",
      email: "admin2fa@codershub.dz",
      role: UserRole.super_admin,
      firstName: "Admin2FA",
      lastName: "Active",
      status: UserStatus.active,
      twoFactorEnabled: true,
      twoFactorSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", // 32-char Base32 secret (20 bytes)
      twoFactorRecoveryCodes: ["11111111", "22222222"],
    },
    {
      id: "00000000-0000-0000-0000-000000000004",
      email: "recruiter@codershub.dz",
      role: UserRole.recruiter_lead,
      firstName: "Sarah",
      lastName: "Recruiter",
      status: UserStatus.invited,
      twoFactorEnabled: false,
      twoFactorRecoveryCodes: [],
    },
    {
      id: "00000000-0000-0000-0000-000000000005",
      email: "sales@codershub.dz",
      role: UserRole.sales,
      firstName: "Mehdi",
      lastName: "Sales",
      status: UserStatus.invited,
      twoFactorEnabled: false,
      twoFactorRecoveryCodes: [],
    },
    {
      id: "00000000-0000-0000-0000-000000000006",
      email: "finance@codershub.dz",
      role: UserRole.finance,
      firstName: "Amel",
      lastName: "Finance",
      status: UserStatus.invited,
      twoFactorEnabled: false,
      twoFactorRecoveryCodes: [],
    },
    {
      id: "00000000-0000-0000-0000-000000000007",
      email: "client@codershub.dz",
      role: UserRole.client_admin,
      firstName: "Thomas",
      lastName: "Client",
      status: UserStatus.active,
      twoFactorEnabled: false,
      twoFactorRecoveryCodes: [],
    },
    {
      id: "00000000-0000-0000-0000-000000000008",
      email: "talent@codershub.dz",
      role: UserRole.talent,
      firstName: "Karim",
      lastName: "Amrani",
      status: UserStatus.active,
      twoFactorEnabled: false,
      twoFactorRecoveryCodes: [],
    },
  ];

  for (const acc of accounts) {
    const user = await prisma.users.upsert({
      where: { email: acc.email },
      update: {
        role: acc.role,
        firstName: acc.firstName,
        lastName: acc.lastName,
        passwordHash,
        status: acc.status,
        twoFactorEnabled: acc.twoFactorEnabled,
        twoFactorSecret: (acc as any).twoFactorSecret ?? null,
        twoFactorRecoveryCodes: acc.twoFactorRecoveryCodes,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        id: acc.id,
        email: acc.email,
        role: acc.role,
        firstName: acc.firstName,
        lastName: acc.lastName,
        passwordHash,
        status: acc.status,
        twoFactorEnabled: acc.twoFactorEnabled,
        twoFactorSecret: (acc as any).twoFactorSecret ?? null,
        twoFactorRecoveryCodes: acc.twoFactorRecoveryCodes,
      },
    });

    // Link client user to company
    if (acc.role === UserRole.client_admin) {
      await prisma.companyUsers.upsert({
        where: {
          companyId_userId: {
            companyId: company.id,
            userId: user.id,
          },
        },
        update: { isAdmin: true, canViewInvoices: true },
        create: {
          companyId: company.id,
          userId: user.id,
          isAdmin: true,
          canViewInvoices: true,
        },
      });
    }

    // Link talent user to talent record
    if (acc.role === UserRole.talent) {
      await prisma.talents.upsert({
        where: { id: "00000000-0000-0000-0000-000000000200" },
        update: { userId: user.id },
        create: {
          id: "00000000-0000-0000-0000-000000000200",
          userId: user.id,
          firstName: "Karim",
          lastName: "Amrani",
          email: acc.email,
          publicSlug: "dev-karim-amrani",
          headline: "Senior Full-Stack TypeScript Architect",
          seniority: SeniorityLevel.senior,
          yearsExperience: new Prisma.Decimal("7.0"),
          vettingStage: VettingStage.active_pool,
          expectedPay: new Prisma.Decimal("2000.00"),
          agreedPay: new Prisma.Decimal("2000.00"),
          city: "Algiers",
          countryCode: "DZ",
        },
      });
    }
  }

  console.log(`- Seeded ${accounts.length} test accounts (Password for all: password123)`);
  console.log("\nDone! All test data successfully seeded.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
