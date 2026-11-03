# PLAN.md — Backend build plan

Build order follows CDC section 17 (Phase 1 = MVP). Do **one module per task**, plan first,
then code, then tests. Tick the box when build, lint and tests pass and `AGENTS.md` §2 is updated.

Legend: **CDC** = sections to read · **Tables** = main tables · **Rules** = section 12 IDs to test.

---

## Phase 0 — Foundations

- [x] **0.1 Repo audit** — read the repo, fill `AGENTS.md` §2, list gaps. No code changes.
- [x] **0.2 Prisma alignment** — `prisma db pull` from the SQL schema, check enums / computed
  columns / unsupported types, `PrismaService`, `withUserContext()` helper, global exception
  filter mapping DB errors, `ValidationPipe`, Swagger, config module, health endpoint.
  Test DB script that loads the SQL file into `DATABASE_URL_TEST`.
- [x] **0.3 Auth review & fix** — CDC 3.2, 8.12, NFR-03. Tables: `users`, `auth_tokens`,
  `user_sessions`, `oauth_accounts`, `staff_profiles`.
  Email + password (Argon2), magic link, email verification, password reset, JWT access +
  refresh (rotated, stored hashed in `user_sessions`), TOTP 2FA (mandatory for staff),
  login rate limiting, `@Roles()` + `RolesGuard`, `@CurrentUser()`, lockout after failed logins.
- [x] **0.4 Users & staff** — CDC 11.2 "Users & roles". Invite staff, assign role, deactivate,
  staff profile (WhatsApp, calendar link), `GET /me`.

## Phase 1 — MVP back-office

- [ ] **1.1 Settings & reference data** — CDC 5.2–5.6, 5.8, 11.2 "Settings".
  Tables: `settings`, `currencies`, `fx_rates`, `legal_entities`, `rate_card_versions`,
  `rate_card_entries`, `discount_rules`, `buyout_tiers`, `referral_reward_rules`,
  `work_calendars`, `public_holidays`, `job_categories`, `job_roles`, `skills`, `languages`, `tags`.
  Includes a `PricingService` (client price from talent pay and margin, T&M hourly/daily,
  part-time, discounts, buy-out fee) used later by placements. Rules: FR-PRICE-01, FR-PRICE-03, FR-PRICE-04.
  Permissions: Super admin edits all; Finance edits pricing settings only.
- [ ] **1.2 Files** — private S3-compatible storage, signed URLs, size/MIME checks
  (CV PDF ≤ 5 MB), `files` table, virus-scan status field. NFR-03.
- [ ] **1.3 Companies, contacts & leads (CRM)** — CDC 6.2, 7.4, 11.2 "Leads & companies".
  Tables: `companies`, `contacts`, `leads`, `notes`, `tasks`, `activities`, `company_tags`.
  Pipeline stages, kanban/list queries, lost reason required (FR-REQ-02), UTM/source, owner.
- [ ] **1.4 Public forms** — CDC 8.1, 8.5, 8.8, 8.11, 7.1 steps 1–2.
  `POST /public/hire-requests` (creates company + contact + lead + talent request, indicative
  price range), `POST /public/talent-applications` (user + talent in `applied` + CV),
  `POST /public/contact`, `POST /public/referrers`. CAPTCHA, rate limit, `form_submissions`, consents.
- [ ] **1.5 Talents & vetting (ATS)** — CDC 6.1, 7.2, 9.2 "My profile / Vetting", 11.2 "Talents".
  Tables: `talents` + skills/languages/experiences/educations/certifications/portfolio/references/
  documents/tags, `vetting_steps`, `scorecards`, `scorecard_scores`.
  Stage moves, scorecards, approval (seniority, agreed pay, showcase), duplicate detection,
  re-apply delay, blacklist. Rules: FR-TAL-03, FR-TAL-04, FR-SEC-01.
- [ ] **1.6 Talent requests, matching & shortlists** — CDC 6.2, 11.2 "Talent requests / Matching".
  Tables: `talent_requests`, `talent_request_skills`, `talent_request_languages`, `shortlists`,
  `shortlist_items`. Manual search with filters, match score (weights from settings),
  48 h SLA deadline, publish shortlist, **anonymised PDF export**. Rules: FR-REQ-01, FR-TAL-01, FR-SEC-01.
- [ ] **1.7 Placements** — CDC 5.2–5.5, 6.3, 11.2 "Placements".
  Tables: `placements`, `placement_onboarding_items`, `check_ins`, `risk_flags`, `absences`,
  `trial_losses`, `buyout_quotes`, `project_milestones`, `status_history`.
  Create from won request with pricing snapshot, margin warning < 30 % and block < 25 %,
  Super admin override, status transitions, trial keep/replace, replacement, notice, buy-out.
  Rules: FR-PRICE-01..04, FR-TAL-02, FR-PLC-01..04, FR-SEC-02.
- [ ] **1.8 Contracts (MVP = upload signed PDFs)** — CDC 11.2 "Contracts".
  Tables: `contracts`, `contract_signatories`. Upload, link to placement/company/talent,
  track dates (start, end, renewal, notice, non-solicit), onboarding checklist sync.
- [ ] **1.9 Invoices & payments (MVP = manual + PDF)** — CDC 5.1, 5.8, 6.4, 11.2 "Invoices".
  Tables: `invoices`, `invoice_lines`, `payments`, `invoice_reminders`, `invoice_number_sequences`.
  Create draft with lines from placements, issue (DB assigns number), PDF EN/FR, credit notes,
  record payments with fees, aging report. Rules: FR-BILL-01..03.
- [ ] **1.10 Payouts (MVP = manual record)** — CDC 6.4, 11.2 "Payouts". Tables: `payouts`,
  `payout_lines`. Rules: FR-PAY-01, FR-PAY-02.
- [ ] **1.11 Referrals (MVP = manual)** — CDC 5.6, 6.5, 7.3. Tables: `referrers`, `referrals`,
  `referral_clicks`, `referral_rewards`. Rules: FR-REF-01.
- [ ] **1.12 Notifications & emails** — CDC 13. Tables: `email_templates`, `notifications`,
  `notification_preferences`. Email provider adapter (Resend/Postmark/Brevo), in-app list, EN/FR.
- [ ] **1.13 Audit log & dashboard** — CDC 11.2 "Dashboard / Audit log". Read endpoints on
  `audit_log`, `status_history`; KPI counters from `v_kpi_mrr`, `v_invoice_aging`,
  `v_placement_economics`.
- [ ] **1.14 MVP acceptance pass** — run every item of CDC 17.2 as an e2e test.

## Phase 2 — Portals & automation (after MVP acceptance)

- [ ] 2.1 Client portal API (requests, shortlists, interviews, team, invoices, company users)
- [ ] 2.2 Talent portal API (profile, vetting, opportunities, mission, timesheets, payouts, documents)
- [ ] 2.3 Interviews + Cal.com/Calendly + Meet/Zoom links
- [ ] 2.4 Timesheets (submit, approve, auto-approve after 3 days)
- [ ] 2.5 Background jobs (BullMQ): monthly invoice drafts, payouts, reminders, SLA alerts, trial day 8
- [ ] 2.6 Contract templates + e-signature
- [ ] 2.7 Slack alerts, reports, public talents directory API

## Open decisions (from CDC 17.3) — ask before building the affected parts

- Legal entity at launch (Algerian SARL / foreign entity / both) → invoices, payouts.
- Talents as freelancers or employees → talent contract type, payouts.
- Indicative prices shown publicly on talent cards or not → public talents API.
- Internal or external technical reviewers → vetting reviewer fees.
- Final default numbers (margins, discounts, trial, buy-out, rewards) → seed data only.
