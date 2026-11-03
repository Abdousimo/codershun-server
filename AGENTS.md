# AGENTS.md — Rules for any AI agent working on this repo

Read this file, `PLAN.md` and the relevant sections of `docs/cdc.md` before every task.
If anything here conflicts with a direct instruction from the developer, ask before acting.

## 1. Project

Coders Hub — IT staff augmentation platform (Algerian tech talent placed with foreign clients).
This repo is the **backend API**: NestJS + TypeScript + Prisma + PostgreSQL.
The full specification is `docs/cdc.md` (the "CDC"). Business rules are in CDC section 12,
statuses in section 6, permissions in sections 3.2 and 11.3, acceptance criteria in 17.2.

## 2. Current state (keep this section up to date)

- SQL schema file: `coders_hub_schema.sql` (root)
- Prisma schema: `prisma/schema.prisma`
- Done modules:
  - `0.1 Repo audit`
  - `0.2 Prisma alignment & foundations` (PrismaService with `withUserContext()`, PrismaExceptionFilter, ValidationPipe, Swagger at `/api/docs`, typed ConfigModule, `/api/v1/health` endpoint, Jest unit/e2e runner, `db:test:reset` script, unsafe `resources` backdoor removed)
  - `0.3 Auth review & fix` (Argon2id password hashing, `@nestjs/jwt` with single-use session rotation in `user_sessions`, `RolesGuard` + `@Roles()` + `@CurrentUser()`, TOTP 2FA with backup codes and mandatory staff check, magic link login, email verification, password reset, account lockout after 5 failed attempts)
  - `0.4 Users & staff` (AdminUsersController under `/api/v1/admin/users`, UsersController under `/api/v1/users`, staff invitation with `auth_tokens`, staff profile management, `staff_requires_2fa` check enforcement, soft-deletion, session revocation on deactivation/deletion)
  - `1.1 Settings & reference data` (SettingsService, exported PricingService with Decimal arithmetic, rate card versioning & snapshots, discount rules & 12% cap, buyout tiers, referral reward rules, legal entities, currencies, FX rates, job categories/roles/skills/languages/tags/calendars; Rules: FR-PRICE-01, FR-PRICE-03, FR-PRICE-04)
  - `1.2 Files` (FilesService, FilesController, AdminFilesController, local disk storage under `uploads/` on VPS with HMAC signatures, SHA-256 calculation, size/MIME validation with 5 MB CV limit, virus-scan tracking with infected download blocks; NFR-03)
  - `1.3 Companies, contacts & leads (CRM)` (CrmService, LeadsController, CompaniesController, CrmTimelineController under `/api/v1/crm`, 9-stage pipeline & Kanban grouping, stage transition side-effects with automatic company client conversion on won, contact management, notes, tasks, soft-deletion; Rule: FR-REQ-02)
  - `1.4 Public forms` (PublicFormsService, PublicFormsController under `/api/v1/public`, multi-step `/hire-requests` with indicative pricing from rate card, `/talent-applications` with candidate CV attachment and vetting pipeline entry, `/contact`, `/referrers` with unique code generation, GDPR consent logging, and form submissions audit)
  - `1.5 Talents & vetting (ATS)` (TalentsService, AdminTalentsController under `/api/v1/admin/talents`, TalentsController under `/api/v1/talents/showcase`, 7-stage vetting pipeline, scorecards & scores, recruiter lead approval, 6-month re-apply delay enforcement, duplicate detection, blacklist, public showcase filtering, and field visibility/anonymisation; Rules: FR-TAL-03, FR-TAL-04, FR-SEC-01)
  - `1.6 Talent requests, matching & shortlists` (TalentRequestsService, MatchingService, ShortlistsService, controllers under `/api/v1/admin/talent-requests`, `/api/v1/admin/shortlists`, `/api/v1/client/talent-requests`, `/api/v1/client/shortlists`, `/api/v1/public/shortlists`, multi-criteria candidate scoring with settings weights, 48h SLA countdown & warning stages, publish flow, client decision tracking, anonymised profiles; Rules: FR-REQ-01, FR-REQ-02, FR-TAL-01, FR-SEC-01)
  - `1.7 Placements` (PlacementsService, PlacementReviewsService, PlacementOnboardingService, controllers under `/api/v1/admin/placements`, `/api/v1/client/placements`, `/api/v1/talent/placements`, pricing snapshots, capacity and margin enforcement, lifecycle transitions, trial decisions, replacements, notices, buy-out quotes, check-ins and risk flags; Rules: FR-PRICE-01..04, FR-TAL-02, FR-PLC-01..04, FR-SEC-02)
  - `1.8 Contracts` (ContractsService and AdminContractsController under `/api/v1/admin/contracts`, contract metadata, PDF and signed PDF uploads, signatories, signature status tracking, and placement onboarding synchronization)
  - `1.9 Invoices & payments` (InvoicesService and AdminInvoicesController under `/api/v1/admin/invoices`, draft invoices, Decimal invoice lines, sequential legal-entity numbering, issued-invoice immutability, credit notes, PDF uploads, manual payments, and payment status tracking; Rules: FR-BILL-01..03)
  - `1.10 Payouts` (PayoutsService and AdminPayoutsController under `/api/v1/admin/payouts`, previous-month payout records, Decimal payout lines, approval and payment tracking, FX/fees/transfer references, statement uploads, and talent scope checks; Rules: FR-PAY-01..02)
  - `1.11 Referrals` (ReferralsService and AdminReferralsController under `/api/v1/admin/referrals`, first-touch 90-day attribution, self-referral protection, referral status lifecycle, reward eligibility, cancellation and payment tracking; Rule: FR-REF-01)
  - `1.12 Notifications & emails` (NotificationsService with user notifications, read state, channel preferences, localized email template management, and admin notification creation; CDC §13)
  - `1.13 Audit log & dashboard` (AuditDashboardService and controller under `/api/v1/admin`, paginated audit/status history reads, and KPI aggregation from `v_kpi_mrr`, `v_invoice_aging`, and `v_placement_economics`)
- Acceptance status: `1.14 MVP acceptance pass` has regression coverage in `src/mvp-acceptance.spec.ts`; full acceptance execution is blocked by the pre-existing missing Files storage implementation.
- Known issues:
  - Remote staging DB currently lacks FK constraints from `coders_hub_schema.sql` (test DB automation uses the SQL schema as truth).

## 3. Golden rules

1. **Plan before code.** For every task, first reply with a plan (files, endpoints, DTOs, rules, tests)
   and wait for approval. Do not write code in the same turn as the plan.
2. **One module per task.** Never touch other modules except to import their exported services.
3. **The SQL schema is the source of truth.** Never edit tables, columns, enums, triggers or views
   without asking. Never run `prisma migrate dev`, `prisma migrate reset` or `prisma db push`.
   Schema changes go in a new hand-written file under `prisma/sql-migrations/NNN_description.sql`,
   then `npx prisma db pull` and `npx prisma generate`.
4. **Never write computed columns.** These are generated by PostgreSQL and must never appear in a
   create/update payload: `placements.client_price_net`, `placements.margin_amount`,
   `placements.margin_pct`, `rate_card_entries.client_price`, `invoices.balance_due`,
   `buyout_quotes.fee`.
5. **Never hard-code business numbers.** Margins, discounts, trial length, SLA hours, due days,
   reward amounts… come from the `settings`, `rate_card_*`, `discount_rules`, `buyout_tiers`
   and `referral_reward_rules` tables (CDC: "store them as settings, never hard-coded").
6. **Money** is `Prisma.Decimal` end to end. Never use JavaScript `number` for amounts or percentages.
   Round to 2 decimals only at the end of a calculation.
7. **Every business rule gets a test.** Each rule ID from CDC section 12 (e.g. `FR-PRICE-02`) that
   the module implements must have at least one unit test whose name contains the rule ID.
8. **Don't invent features.** If the CDC is silent or unclear, stop and ask. List open questions
   at the end of the plan.
9. **Small, working steps.** After each step: `npm run build`, `npm run lint`, `npm test` must pass.
   Report the results. Never leave the build broken.
10. **Secrets** only from environment variables via `@nestjs/config`. Never commit `.env`.

## 4. Architecture

```
src/
  main.ts
  app.module.ts
  common/            guards, decorators, filters, interceptors, pipes, utils (money, dates)
  prisma/            PrismaService + withUserContext() transaction helper
  config/            typed config
  modules/
    <module>/
      <module>.module.ts
      <module>.controller.ts      (thin: validation, auth, mapping only)
      <module>.service.ts         (business logic)
      dto/                        create-*.dto.ts, update-*.dto.ts, query-*.dto.ts, *.response.ts
      <module>.service.spec.ts
      <module>.e2e-spec.ts        (optional)
```

- Controllers never call Prisma directly; services do.
- Services return response DTOs / plain objects, never raw Prisma models with hidden fields.
- One `PrismaService` (extends `PrismaClient`), injected everywhere.
- Shared helpers in `src/common/` — check there before writing a new one.

## 5. API conventions

- REST, JSON, prefix `/api/v1`. Resource names plural kebab-case: `/talent-requests`.
- Route groups by space: `/api/v1/admin/...` (staff), `/api/v1/client/...` (client portal),
  `/api/v1/talent/...` (talent portal), `/api/v1/public/...` (no auth).
- Validation: global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`,
  DTOs with `class-validator` + `class-transformer`.
- Lists: `?page=1&pageSize=25&sort=createdAt:desc&search=...` → `{ data, meta: { page, pageSize, total } }`.
- Errors: use Nest HTTP exceptions; business-rule violations return `422` with
  `{ code: "FR-PRICE-02", message: "..." }`. Map PostgreSQL trigger/check errors
  (codes `23514`, `P0001`, `23505`) to readable 409/422 responses in a global exception filter.
- Swagger (`@nestjs/swagger`) on every endpoint, available at `/api/docs` outside production.
- Dates: ISO 8601 strings, stored as `timestamptz` / `date`. Timezone logic in `common/utils/dates.ts`.

## 6. Auth and permissions

- Roles (enum `user_role`): `talent`, `client_user`, `client_admin`, `referrer`, `recruiter`,
  `recruiter_lead`, `sales`, `account_manager`, `finance`, `super_admin`.
- Every non-public route has `@Roles(...)` and goes through `JwtAuthGuard` + `RolesGuard`.
- **Scope checks in services**: a client only sees rows where `company_id` = their company;
  a talent only sees their own `talent_id`. Never trust an id from the URL without checking ownership.
- **Field visibility (FR-SEC-01 / FR-SEC-02)** — enforce in response DTOs:
  - Clients never see `talent_pay`, `talent_daily_pay`, `margin_*`, talent personal email/phone.
  - Talents never see `client_price*`, `discount_pct`, `margin_*`, other talents' pay.
  - Recruiters never see client prices or margin; Sales cannot edit talent pay (CDC 11.3).
- Staff accounts require 2FA (enforced by a DB check when status is `active`).
- DB context: money and status writes run inside `prisma.withUserContext(user, async (tx) => ...)`,
  which executes `SET LOCAL app.user_id`, `app.role`, `app.ip` (and `app.company_id` / `app.talent_id`)
  so the audit-log and status-history triggers know who acted.

## 7. Business rules handled by the database (don't duplicate, handle the errors)

The SQL schema already enforces: margin floor (`FR-PRICE-02`), discount cap 12 % (`FR-PRICE-04`),
price freeze after signature (`FR-PRICE-03`), placement status transitions (6.3), one full-time
placement / 100 % capacity (`FR-TAL-02`), shortlist only vetted/available talents (`FR-TAL-01`),
self-referral block (`FR-REF-01`), invoice numbering and immutability (`FR-BILL-02`),
payments → invoice paid status, low check-in → risk flag, audit log, status history.

The service layer still **validates first** (to return a clear 422 before hitting the DB) and
treats the DB as the safety net.

## 8. Testing

- Jest. Unit tests for services with a mocked Prisma, plus e2e tests against a **separate test
  database** (`DATABASE_URL_TEST`) loaded from the SQL schema file. Never run tests on the online DB.
- Use CDC 17.2 acceptance criteria as test cases (e.g. talent pay €1,200 at 40 % → client price
  €2,000, margin €800; 20 % margin rejected without Super admin approval).

## 9. Git

- One branch per module: `feat/<module>`. Conventional commits (`feat:`, `fix:`, `test:`, `refactor:`).
- At the end of a module: update section 2 of this file and tick the box in `PLAN.md`.
