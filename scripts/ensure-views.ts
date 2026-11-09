import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import dotenv from "dotenv";
dotenv.config();

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to ensure database views");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const views = [
  {
    name: "v_client_placements",
    sql: `
CREATE OR REPLACE VIEW v_client_placements AS
SELECT p.id, p.reference, p.company_id, p.talent_id,
       t.first_name, t.last_name,
       jr.name_en AS role_name, p.seniority, p.engagement_model, p.time_share_pct,
       p.status, p.start_date, p.trial_end_date, p.notice_end_date, p.end_date,
       p.currency, p.client_price, p.discount_pct, p.client_price_net, p.hourly_rate, p.daily_rate,
       (SELECT c.score FROM check_ins c WHERE c.placement_id = p.id AND c.type = 'client_quarterly'
        ORDER BY c.period_start DESC LIMIT 1) AS last_client_nps
FROM placements p
JOIN talents t ON t.id = p.talent_id
LEFT JOIN job_roles jr ON jr.id = p.job_role_id;
    `,
  },
  {
    name: "v_talent_placements",
    sql: `
CREATE OR REPLACE VIEW v_talent_placements AS
SELECT p.id, p.reference, p.talent_id, p.company_id, co.name AS client_name, co.industry,
       p.engagement_model, p.time_share_pct, p.status, p.start_date, p.trial_end_date,
       p.notice_period_days, p.notice_end_date, p.end_date,
       p.currency, p.talent_pay, p.talent_daily_pay, p.paid_leave_days_per_month
FROM placements p
JOIN companies co ON co.id = p.company_id;
    `,
  },
  {
    name: "v_client_shortlist_items",
    sql: `
CREATE OR REPLACE VIEW v_client_shortlist_items AS
SELECT si.id, s.request_id, tr.company_id, si.talent_id,
       CASE WHEN si.contact_revealed_at IS NOT NULL THEN t.first_name || ' ' || t.last_name
            ELSE coalesce(t.public_display_name, t.first_name || ' ' || left(t.last_name, 1) || '.') END AS display_name,
       t.headline, t.seniority, t.years_experience, t.vetting_score, t.availability_date,
       si.match_score, si.recruiter_note, si.proposed_client_price, si.proposed_currency,
       si.client_decision, si.client_decision_reason
FROM shortlist_items si
JOIN shortlists s ON s.id = si.shortlist_id AND s.status = 'published'
JOIN talent_requests tr ON tr.id = s.request_id
JOIN talents t ON t.id = si.talent_id;
    `,
  },
  {
    name: "v_public_talents",
    sql: `
CREATE OR REPLACE VIEW v_public_talents AS
SELECT t.public_slug, t.public_display_name, jr.slug AS role_slug, jr.name_en AS role_en, jr.name_fr AS role_fr,
       jc.slug AS category_slug, t.seniority, t.years_experience, t.vetting_score,
       t.availability_date, t.time_share_pct,
       CASE WHEN t.show_indicative_price THEN rce.client_price END AS from_price_eur,
       ARRAY(SELECT s.name::text FROM talent_skills ts JOIN skills s ON s.id = ts.skill_id
             WHERE ts.talent_id = t.id ORDER BY ts.is_top_skill DESC, ts.years DESC NULLS LAST LIMIT 4) AS top_skills,
       ARRAY(SELECT tl.language_code || ':' || tl.level FROM talent_languages tl WHERE tl.talent_id = t.id) AS languages
FROM talents t
LEFT JOIN job_roles jr ON jr.id = t.job_role_id
LEFT JOIN job_categories jc ON jc.id = t.category_id
LEFT JOIN rate_card_versions rcv ON rcv.is_current
LEFT JOIN rate_card_entries rce ON rce.rate_card_version_id = rcv.id AND rce.seniority = t.seniority
WHERE t.showcase_published AND t.vetting_stage = 'vetted' AND NOT t.is_blacklisted
  AND t.deleted_at IS NULL AND t.status IN ('available','proposed');
    `,
  },
  {
    name: "v_placement_economics",
    sql: `
CREATE OR REPLACE VIEW v_placement_economics AS
SELECT p.id, p.reference, p.company_id, p.talent_id, p.status, p.currency,
       p.client_price_net, p.talent_pay, p.margin_amount, p.margin_pct,
       coalesce(inv.revenue, 0)             AS revenue_invoiced,
       coalesce(inv.talent_cost, 0)         AS talent_cost_accrued,
       coalesce(po.paid_to_talent, 0)       AS talent_paid,
       round(coalesce(fees.payment_fees, 0)::numeric, 2) AS payment_fees,
       round(coalesce(rw.referral_cost, 0)::numeric, 2)  AS referral_cost,
       coalesce(tl.trial_loss, 0)           AS trial_loss,
       round((coalesce(inv.revenue, 0) - coalesce(inv.talent_cost, 0) - coalesce(fees.payment_fees, 0)
         - coalesce(rw.referral_cost, 0) - coalesce(tl.trial_loss, 0))::numeric, 2) AS contribution_margin
FROM placements p
LEFT JOIN LATERAL (
  SELECT sum(CASE WHEN i.kind = 'credit_note' THEN -il.amount ELSE il.amount END) AS revenue,
         sum(CASE WHEN i.kind = 'credit_note' THEN -coalesce(il.talent_cost, 0) ELSE coalesce(il.talent_cost, 0) END) AS talent_cost
  FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id
  WHERE il.placement_id = p.id AND i.status NOT IN ('draft','void')) inv ON true
LEFT JOIN LATERAL (
  SELECT sum(pl.amount) AS paid_to_talent FROM payout_lines pl JOIN payouts po ON po.id = pl.payout_id
  WHERE pl.placement_id = p.id AND po.status = 'paid') po ON true
LEFT JOIN LATERAL (
  SELECT sum(pay.fees * il.amount / nullif(i.total, 0)) AS payment_fees
  FROM invoice_lines il JOIN invoices i ON i.id = il.invoice_id JOIN payments pay ON pay.invoice_id = i.id
  WHERE il.placement_id = p.id) fees ON true
LEFT JOIN LATERAL (
  SELECT sum(rr.amount + rr.fees)
         / nullif((SELECT count(*) FROM placements p2 WHERE p2.company_id = p.company_id
                   AND p2.status NOT IN ('draft','cancelled')), 0) AS referral_cost
  FROM referral_rewards rr JOIN referrals r ON r.id = rr.referral_id
  WHERE r.company_id = p.company_id AND rr.status = 'paid') rw ON true
LEFT JOIN LATERAL (
  SELECT talent_cost AS trial_loss FROM trial_losses WHERE placement_id = p.id) tl ON true;
    `,
  },
  {
    name: "v_kpi_mrr",
    sql: `
CREATE OR REPLACE VIEW v_kpi_mrr AS
SELECT currency,
       count(*)                                   AS active_placements,
       sum(client_price_net)                      AS mrr,
       sum(margin_amount)                         AS monthly_gross_margin,
       round(sum(margin_amount) / nullif(sum(client_price_net), 0) * 100, 2) AS gross_margin_pct
FROM placements
WHERE status IN ('in_trial','active','notice')
GROUP BY currency;
    `,
  },
  {
    name: "v_invoice_aging",
    sql: `
CREATE OR REPLACE VIEW v_invoice_aging AS
SELECT i.id, i.number, i.company_id, i.currency, i.total, i.balance_due, i.due_date,
       greatest(current_date - i.due_date, 0) AS days_overdue,
       CASE WHEN i.due_date >= current_date THEN 'not_due'
            WHEN current_date - i.due_date <= 15 THEN '1_15'
            WHEN current_date - i.due_date <= 30 THEN '16_30'
            ELSE '30_plus' END AS bucket
FROM invoices i
WHERE i.kind = 'invoice' AND i.status IN ('issued','partially_paid','overdue');
    `,
  },
];

export async function ensureDatabaseViews(): Promise<void> {
  console.log("Ensuring database views exist...");
  for (const v of views) {
    try {
      await prisma.$executeRawUnsafe(v.sql);
      console.log(`  ✓ ${v.name}`);
    } catch (err: any) {
      console.error(`  ✗ Error creating ${v.name}:`, err.message);
      throw err;
    }
  }
}

if (process.argv[1]?.endsWith("ensure-views.ts") || process.argv[1]?.endsWith("ensure-views.js")) {
  ensureDatabaseViews()
    .then(() => {
      console.log("All database views verified successfully.");
    })
    .catch((err) => {
      console.error("Failed to verify views:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

