import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ensureDatabaseViews } from "./ensure-views";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the cleanup script");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// Tables to truncate completely (all operational & transactional records)
const tablesToTruncate = [
  // 1. Talent Requests & Shortlists
  "talent_request_skills",
  "talent_request_languages",
  "talent_requests",
  "shortlist_items",
  "shortlists",

  // 2. Interviews
  "interview_feedback",
  "interview_participants",
  "interview_slots",
  "interviews",

  // 3. Placements, Operations & Status
  "placement_status_transitions",
  "placement_onboarding_items",
  "check_ins",
  "risk_flags",
  "absences",
  "trial_losses",
  "buyout_quotes",
  "project_milestones",
  "placements",
  "status_history",

  // 4. Contracts
  "contract_signatories",
  "contracts",

  // 5. Timesheets
  "timesheet_entries",
  "timesheets",

  // 6. Invoices & Payments
  "invoice_reminders",
  "payments",
  "invoice_lines",
  "invoices",

  // 7. Payouts
  "payout_lines",
  "payouts",

  // 8. Referrals & Form Leads
  "referral_clicks",
  "referral_rewards",
  "referrals",
  "form_submissions",
  "leads",

  // 9. Logs, Notes & Notifications
  "notes",
  "tasks",
  "activities",
  "entity_attachments",
  "notifications",
  "scheduled_jobs_log",
  "audit_log",
];

async function cleanTestData() {
  console.log("🧹 Starting database cleanup for tester...");
  console.log("Preserving: Users, Companies, Talent Profiles, and system reference data.\n");

  try {
    for (const table of tablesToTruncate) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`  ✓ Truncated: ${table}`);
      } catch (err: any) {
        console.warn(`  ⚠ Warning on ${table}: ${err.message}`);
      }
    }

    console.log("\nRe-verifying database views...");
    await ensureDatabaseViews();

    console.log("\n--- Verification of Preserved Data ---");
    const [usersCount, companiesCount, talentsCount] = await Promise.all([
      prisma.users.count(),
      prisma.companies.count(),
      prisma.talents.count(),
    ]);

    console.log(`  • Users preserved: ${usersCount}`);
    console.log(`  • Companies preserved: ${companiesCount}`);
    console.log(`  • Talent profiles preserved: ${talentsCount}`);

    console.log("\n--- Verification of Truncated Operational Data ---");
    const [requestsCount, placementsCount, invoicesCount, timesheetsCount, interviewsCount, referralsCount] = await Promise.all([
      prisma.talentRequests.count(),
      prisma.placements.count(),
      prisma.invoices.count(),
      prisma.timesheets.count(),
      prisma.interviews.count(),
      prisma.referrals.count(),
    ]);

    console.log(`  • Talent Requests: ${requestsCount}`);
    console.log(`  • Placements: ${placementsCount}`);
    console.log(`  • Invoices: ${invoicesCount}`);
    console.log(`  • Timesheets: ${timesheetsCount}`);
    console.log(`  • Interviews: ${interviewsCount}`);
    console.log(`  • Referrals: ${referralsCount}`);

    console.log("\n✨ Database cleanup complete! Ready for fresh end-to-end testing.");
  } catch (error) {
    console.error("Fatal error during cleanup:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanTestData();
