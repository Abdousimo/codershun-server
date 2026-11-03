-- =============================================================================
--  Coders Hub — IT Staffing Platform
--  PostgreSQL schema (all modules except the CMS)
--  Source: CDC "IT Staffing Platform (Coders Hub)", sections 3, 5, 6, 8–14
--  Target: PostgreSQL 15+
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy search on names / skills

-- -----------------------------------------------------------------------------
-- 0. Helpers
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- -----------------------------------------------------------------------------
-- 1. Enumerations (status lifecycles from section 6)
-- -----------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
  'talent', 'client_user', 'client_admin', 'referrer',
  'recruiter', 'recruiter_lead', 'sales', 'account_manager', 'finance', 'super_admin'
);
CREATE TYPE user_status        AS ENUM ('invited', 'active', 'suspended', 'deactivated', 'deleted');
CREATE TYPE ui_language        AS ENUM ('en', 'fr', 'ar');
CREATE TYPE auth_token_type    AS ENUM ('magic_link', 'email_verification', 'password_reset', 'invitation');

CREATE TYPE engagement_model AS ENUM (
  'time_material', 'dedicated_developer', 'team_extension', 'dedicated_team', 'project_based'
);
CREATE TYPE seniority_level    AS ENUM ('junior', 'mid', 'senior', 'lead');
CREATE TYPE cefr_level         AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native');
CREATE TYPE skill_level        AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

CREATE TYPE company_status     AS ENUM ('lead', 'client', 'churned');
CREATE TYPE lead_stage AS ENUM (
  'new_lead', 'contacted', 'qualified', 'sourcing', 'shortlist_sent',
  'interviewing', 'proposal_sent', 'won', 'lost'
);
CREATE TYPE lead_source AS ENUM (
  'hire_form', 'booked_call', 'contact_form', 'referral', 'talent_profile', 'manual', 'import', 'other'
);
CREATE TYPE lost_reason        AS ENUM ('price', 'timing', 'no_fit', 'competitor', 'no_answer', 'other');

CREATE TYPE request_status AS ENUM (
  'open', 'sourcing', 'shortlist_sent', 'interviewing', 'proposal_sent', 'won', 'lost', 'cancelled'
);
CREATE TYPE start_window       AS ENUM ('asap', 'two_weeks', 'one_month', 'later');
CREATE TYPE duration_bucket    AS ENUM ('1_3_months', '3_6_months', '6_12_months', '12_plus_months');

-- Vetting pipeline (6.1) and availability status after vetting
CREATE TYPE vetting_stage AS ENUM (
  'applied', 'screening', 'hr_interview', 'technical_test', 'tech_interview',
  'references', 'vetted', 'rejected', 'expired', 'on_hold'
);
CREATE TYPE talent_status AS ENUM (
  'in_vetting', 'available', 'proposed', 'in_trial', 'placed', 'inactive', 'blacklisted'
);
CREATE TYPE vetting_step_type  AS ENUM ('cv_screening', 'hr_call', 'technical_test', 'technical_interview', 'reference_check', 'approval');
CREATE TYPE vetting_step_status AS ENUM ('pending', 'scheduled', 'in_progress', 'passed', 'failed', 'expired', 'skipped');
CREATE TYPE recommendation     AS ENUM ('strong_yes', 'yes', 'no', 'strong_no');
CREATE TYPE reject_category    AS ENUM ('experience', 'stack', 'language', 'communication', 'technical', 'references', 'pay_expectation', 'other');

CREATE TYPE shortlist_status   AS ENUM ('draft', 'published', 'closed');
CREATE TYPE client_decision    AS ENUM ('pending', 'interview', 'not_a_fit', 'hire');
CREATE TYPE talent_response    AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE interview_status   AS ENUM ('proposed', 'scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled');
CREATE TYPE interview_decision AS ENUM ('hire', 'next_round', 'reject', 'undecided');

CREATE TYPE placement_status AS ENUM (
  'draft', 'pending_start', 'in_trial', 'active', 'notice',
  'ended_in_trial', 'replaced', 'bought_out', 'ended', 'cancelled'
);
CREATE TYPE notice_party       AS ENUM ('client', 'talent', 'agency');
CREATE TYPE checkin_type       AS ENUM ('talent_monthly', 'client_quarterly');
CREATE TYPE absence_type       AS ENUM ('paid_leave', 'unpaid_leave', 'sick', 'public_holiday', 'other');
CREATE TYPE risk_flag_source   AS ENUM ('low_checkin', 'low_nps', 'overdue_invoice', 'manual');

CREATE TYPE contract_type AS ENUM (
  'client_msa', 'client_order_form', 'client_nda', 'talent_freelance_agreement',
  'talent_employment', 'talent_nda', 'talent_ip_assignment', 'buyout_agreement'
);
CREATE TYPE signature_status   AS ENUM ('draft', 'sent', 'partially_signed', 'signed', 'declined', 'expired', 'void');

CREATE TYPE timesheet_status   AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'auto_approved');
CREATE TYPE invoice_kind       AS ENUM ('invoice', 'credit_note');
CREATE TYPE invoice_status     AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void');
CREATE TYPE invoice_line_kind  AS ENUM ('dedicated_fee', 'time_material', 'buyout_fee', 'project_milestone', 'proration', 'absence_credit', 'discount', 'adjustment', 'other');
CREATE TYPE payment_method     AS ENUM ('swift', 'sepa', 'payoneer', 'card', 'local_transfer', 'other');
CREATE TYPE payout_status      AS ENUM ('pending', 'approved', 'paid', 'cancelled');
CREATE TYPE payout_line_kind   AS ENUM ('days_worked', 'trial_days', 'bonus', 'deduction', 'paid_leave', 'referral_bonus', 'adjustment');

CREATE TYPE referrer_kind      AS ENUM ('client', 'talent', 'partner', 'external');
CREATE TYPE referral_status    AS ENUM ('submitted', 'contacted', 'won', 'lost');
CREATE TYPE reward_type        AS ENUM ('monthly_plan', 'team', 'annual_plan', 'talent_referral');
CREATE TYPE reward_status      AS ENUM ('pending', 'payable', 'paid', 'cancelled');

CREATE TYPE document_type AS ENUM (
  'cv', 'id_card', 'passport', 'tax_card', 'auto_entrepreneur_card', 'bank_proof',
  'payoneer_proof', 'portfolio', 'test_result', 'contract', 'invoice_pdf',
  'payout_statement', 'anonymised_profile', 'shortlist_pdf', 'other'
);
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'slack');
CREATE TYPE audit_action       AS ENUM ('create', 'update', 'delete', 'status_change', 'login', 'export', 'approve', 'override');
CREATE TYPE consent_type       AS ENUM ('privacy_policy', 'terms', 'talent_terms', 'referral_terms', 'showcase', 'marketing', 'cookies_analytics');
CREATE TYPE gdpr_request_type  AS ENUM ('export', 'deletion', 'rectification');
CREATE TYPE gdpr_request_status AS ENUM ('received', 'in_progress', 'completed', 'rejected');
CREATE TYPE task_status        AS ENUM ('open', 'done', 'cancelled');

-- -----------------------------------------------------------------------------
-- 2. Reference data & settings (5.2 – 5.8, 11.2 "Settings")
-- -----------------------------------------------------------------------------

CREATE TABLE currencies (
  code            char(3) PRIMARY KEY,               -- EUR, USD, GBP, DZD
  name            text    NOT NULL,
  symbol          text,
  minor_units     smallint NOT NULL DEFAULT 2,
  is_client_currency boolean NOT NULL DEFAULT false,  -- allowed on client contracts
  is_active       boolean NOT NULL DEFAULT true
);

CREATE TABLE fx_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency   char(3) NOT NULL REFERENCES currencies(code),
  quote_currency  char(3) NOT NULL REFERENCES currencies(code),
  rate            numeric(18,8) NOT NULL CHECK (rate > 0),
  rate_date       date NOT NULL,
  source          text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base_currency, quote_currency, rate_date, source)
);

-- Several invoicing entities (Algerian SARL, foreign entity, Payoneer...)
CREATE TABLE legal_entities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  legal_form          text,                          -- SARL, EURL, SAS, OÜ, LLC
  country_code        char(2) NOT NULL,
  registration_number text,
  tax_id              text,
  address             text,
  bank_name           text,
  iban                text,
  swift_bic           text,
  payoneer_account    text,
  default_currency    char(3) NOT NULL REFERENCES currencies(code),
  invoice_prefix      text NOT NULL,                 -- e.g. "CH-DZ"
  credit_note_prefix  text NOT NULL DEFAULT 'CN',
  tax_mentions        jsonb NOT NULL DEFAULT '{}',   -- {"en": "Reverse charge...", "fr": "Autoliquidation..."}
  default_vat_rate    numeric(5,2) NOT NULL DEFAULT 0,
  accepts_card_payments boolean NOT NULL DEFAULT false,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Generic key/value settings (trial length, floor margin, SLA hours, matching weights...)
CREATE TABLE settings (
  key             text PRIMARY KEY,
  value           jsonb NOT NULL,
  description     text,
  updated_by      uuid,                              -- FK added after users
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Rate card (5.2). Versioned: a change never alters signed placements (FR-PRICE-03)
CREATE TABLE rate_card_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label           text NOT NULL,
  valid_from      date NOT NULL,
  valid_to        date,
  is_current      boolean NOT NULL DEFAULT false,
  hours_per_month numeric(6,2) NOT NULL DEFAULT 160,
  tm_premium_pct  numeric(5,2) NOT NULL DEFAULT 15,  -- hourly = monthly / 160 × 1.15
  hours_per_day   numeric(4,2) NOT NULL DEFAULT 8,
  part_time_price_pct numeric(5,2) NOT NULL DEFAULT 55,
  floor_margin_pct    numeric(5,2) NOT NULL DEFAULT 25,
  warning_margin_pct  numeric(5,2) NOT NULL DEFAULT 30,
  max_combined_discount_pct numeric(5,2) NOT NULL DEFAULT 12,
  min_dedicated_months smallint NOT NULL DEFAULT 1,
  min_tm_hours    smallint NOT NULL DEFAULT 40,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_current_rate_card ON rate_card_versions ((is_current)) WHERE is_current;

CREATE TABLE rate_card_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_version_id uuid NOT NULL REFERENCES rate_card_versions(id) ON DELETE CASCADE,
  seniority           seniority_level NOT NULL,
  min_years           smallint NOT NULL,
  max_years           smallint,
  talent_net_pay      numeric(12,2) NOT NULL,        -- €/month
  target_margin_pct   numeric(5,2) NOT NULL CHECK (target_margin_pct > 0 AND target_margin_pct < 100),
  currency            char(3) NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  client_price        numeric(12,2) GENERATED ALWAYS AS (round(talent_net_pay / (1 - target_margin_pct / 100), 2)) STORED,
  UNIQUE (rate_card_version_id, seniority)
);

CREATE TABLE discount_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,              -- team_3_plus, commit_6m, commit_12m
  label           text NOT NULL,
  discount_pct    numeric(5,2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  min_talents     smallint,
  min_commitment_months smallint,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE buyout_tiers (                         -- 5.5
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_month      smallint NOT NULL,
  to_month        smallint,                          -- NULL = open ended
  multiplier      numeric(5,2) NOT NULL,             -- × monthly client price (0 = free)
  is_active       boolean NOT NULL DEFAULT true,
  UNIQUE (from_month)
);

CREATE TABLE referral_reward_rules (                -- 5.6
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_type     reward_type NOT NULL UNIQUE,
  base_amount     numeric(12,2) NOT NULL,
  per_extra_talent_amount numeric(12,2) NOT NULL DEFAULT 0,
  extra_talent_threshold  smallint,
  currency        char(3) NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  paid_invoices_required smallint NOT NULL DEFAULT 2,
  min_client_months smallint NOT NULL DEFAULT 3,
  attribution_days smallint NOT NULL DEFAULT 90,
  is_active       boolean NOT NULL DEFAULT true
);

-- Working calendars and holidays (6.4 absences / national holidays)
CREATE TABLE work_calendars (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  country_code    char(2) NOT NULL,
  working_days    smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',   -- ISO weekday numbers
  UNIQUE (name)
);

CREATE TABLE public_holidays (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id     uuid NOT NULL REFERENCES work_calendars(id) ON DELETE CASCADE,
  holiday_date    date NOT NULL,
  name            text NOT NULL,
  UNIQUE (calendar_id, holiday_date)
);

-- Savings calculator data (8.6)
CREATE TABLE salary_benchmarks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code    char(2) NOT NULL,
  job_role_id     uuid,                              -- FK added after job_roles
  seniority       seniority_level NOT NULL,
  yearly_employer_cost numeric(12,2) NOT NULL,
  currency        char(3) NOT NULL REFERENCES currencies(code),
  source_name     text NOT NULL,
  source_url      text,
  valid_year      smallint NOT NULL,
  UNIQUE (country_code, job_role_id, seniority, valid_year)
);

-- -----------------------------------------------------------------------------
-- 3. Identity, auth & access (3.2, 8.12, NFR-03, NFR-04)
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               citext NOT NULL UNIQUE,
  email_verified_at   timestamptz,
  password_hash       text,                          -- Argon2/bcrypt; NULL for magic-link only
  role                user_role NOT NULL,
  first_name          text,
  last_name           text,
  avatar_file_id      uuid,                          -- FK added after files
  phone               text,
  language            ui_language NOT NULL DEFAULT 'en',
  timezone            text NOT NULL DEFAULT 'Europe/Paris',
  two_factor_enabled  boolean NOT NULL DEFAULT false,
  two_factor_secret   text,                          -- encrypted at application level
  two_factor_recovery_codes text[],
  status              user_status NOT NULL DEFAULT 'active',
  last_login_at       timestamptz,
  last_login_ip       inet,
  failed_login_count  smallint NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  -- 2FA mandatory for agency staff (8.12 / NFR-03): enforced once the account is active
  CONSTRAINT staff_requires_2fa CHECK (
    role NOT IN ('recruiter','recruiter_lead','sales','account_manager','finance','super_admin')
    OR status <> 'active' OR two_factor_enabled
  )
);

ALTER TABLE settings            ADD CONSTRAINT settings_updated_by_fk  FOREIGN KEY (updated_by) REFERENCES users(id);
ALTER TABLE rate_card_versions  ADD CONSTRAINT rcv_created_by_fk       FOREIGN KEY (created_by) REFERENCES users(id);

CREATE TABLE oauth_accounts (                       -- Google sign-in (S)
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            text NOT NULL,                 -- google
  provider_account_id text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE auth_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  email           citext NOT NULL,
  token_hash      text NOT NULL UNIQUE,              -- store hash only
  type            auth_token_type NOT NULL,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  ip              inet,
  user_agent      text,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Agency staff profile (account manager card in client portal, 10.2)
CREATE TABLE staff_profiles (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  job_title       text,
  whatsapp        text,
  calendar_url    text,                              -- Calendly / Cal.com link
  slack_user_id   text,
  is_reviewer     boolean NOT NULL DEFAULT false,    -- can run technical interviews
  is_external_reviewer boolean NOT NULL DEFAULT false,
  reviewer_fee    numeric(10,2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Consents (GDPR + Algerian law 18-07)
CREATE TABLE consents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE CASCADE,
  email           citext,                            -- for visitors without account
  consent_type    consent_type NOT NULL,
  document_version text,
  granted         boolean NOT NULL,
  ip              inet,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE gdpr_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  email           citext NOT NULL,
  request_type    gdpr_request_type NOT NULL,
  status          gdpr_request_status NOT NULL DEFAULT 'received',
  due_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  completed_at    timestamptz,
  handled_by      uuid REFERENCES users(id),
  export_file_id  uuid,                              -- FK added after files
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Files in the private S3 bucket (signed URLs)
CREATE TABLE files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key     text NOT NULL UNIQUE,
  bucket          text NOT NULL DEFAULT 'private',
  original_name   text NOT NULL,
  mime_type       text NOT NULL,
  size_bytes      bigint NOT NULL CHECK (size_bytes >= 0),
  checksum_sha256 text,
  virus_scan_status text NOT NULL DEFAULT 'pending' CHECK (virus_scan_status IN ('pending','clean','infected','error')),
  uploaded_by     uuid REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users         ADD CONSTRAINT users_avatar_fk  FOREIGN KEY (avatar_file_id) REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE gdpr_requests ADD CONSTRAINT gdpr_export_fk   FOREIGN KEY (export_file_id) REFERENCES files(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- 4. Taxonomy: categories, roles, skills, languages, tags
-- -----------------------------------------------------------------------------

CREATE TABLE job_categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,              -- development, design, infra
  name_en         text NOT NULL,
  name_fr         text NOT NULL,
  name_ar         text,
  is_on_request   boolean NOT NULL DEFAULT false,    -- "on request" until pool is deep (1.4)
  sort_order      smallint NOT NULL DEFAULT 0
);

CREATE TABLE job_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid NOT NULL REFERENCES job_categories(id),
  slug            text NOT NULL UNIQUE,              -- react-developer, ui-ux-designer
  name_en         text NOT NULL,
  name_fr         text NOT NULL,
  name_ar         text,
  is_rare_skill   boolean NOT NULL DEFAULT false,
  skill_premium_pct numeric(5,2) NOT NULL DEFAULT 0 CHECK (skill_premium_pct BETWEEN 0 AND 50), -- +10–20 %
  is_active       boolean NOT NULL DEFAULT true
);

ALTER TABLE salary_benchmarks ADD CONSTRAINT sb_role_fk FOREIGN KEY (job_role_id) REFERENCES job_roles(id);

CREATE TABLE skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            citext NOT NULL UNIQUE,
  slug            text NOT NULL UNIQUE,
  category_id     uuid REFERENCES job_categories(id),
  is_rare         boolean NOT NULL DEFAULT false,
  premium_pct     numeric(5,2) NOT NULL DEFAULT 0,
  aliases         text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX skills_name_trgm ON skills USING gin (name gin_trgm_ops);

CREATE TABLE languages (
  code            text PRIMARY KEY,                  -- en, fr, ar, de
  name            text NOT NULL
);

CREATE TABLE tags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            citext NOT NULL,
  scope           text NOT NULL CHECK (scope IN ('talent','company','lead','request','placement')),
  color           text,
  UNIQUE (scope, name)
);

-- -----------------------------------------------------------------------------
-- 5. Referrers (needed by companies / leads) — 5.6, 6.5, 7.3
-- -----------------------------------------------------------------------------

CREATE TABLE referrers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,   -- NULL for light external referrers
  kind            referrer_kind NOT NULL,
  name            text NOT NULL,
  email           citext NOT NULL,
  phone           text,
  company_id      uuid,                              -- own company, used to block self-referral (FK below)
  code            text NOT NULL UNIQUE,              -- personal link / code
  payment_method  payment_method,
  payment_details jsonb NOT NULL DEFAULT '{}',       -- IBAN / Payoneer email (encrypt at app level)
  terms_accepted_at timestamptz,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users(id)
);

-- -----------------------------------------------------------------------------
-- 6. CRM: companies, contacts, client users, leads (6.2, 10, 11 "Leads & companies")
-- -----------------------------------------------------------------------------

CREATE TABLE companies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  legal_name          text,
  country_code        char(2),
  industry            text,
  size_range          text CHECK (size_range IN ('1-10','11-50','51-200','201-500','501-1000','1000+')),
  website             text,
  vat_number          text,
  billing_address     text,
  billing_city        text,
  billing_postal_code text,
  billing_country_code char(2),
  billing_email       citext,
  legal_entity_id     uuid REFERENCES legal_entities(id),  -- invoicing entity used
  currency            char(3) NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  status              company_status NOT NULL DEFAULT 'lead',
  source              lead_source,
  referral_id         uuid,                          -- FK added after referrals
  account_manager_id  uuid REFERENCES users(id),
  work_calendar_id    uuid REFERENCES work_calendars(id),
  payment_terms_days  smallint NOT NULL DEFAULT 7,
  is_overdue_flagged  boolean NOT NULL DEFAULT false,         -- FR-BILL-03 (+15 days)
  requests_blocked_at timestamptz,                             -- FR-BILL-03 (+30 days)
  requests_blocked_by uuid REFERENCES users(id),
  notes               text,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id)
);
CREATE INDEX companies_name_trgm ON companies USING gin (name gin_trgm_ops);
CREATE INDEX companies_status_idx ON companies (status);

ALTER TABLE referrers ADD CONSTRAINT referrers_company_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

CREATE TABLE contacts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id             uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,  -- when the contact has portal access
  first_name          text NOT NULL,
  last_name           text,
  email               citext,
  phone               text,
  job_title           text,
  is_decision_maker   boolean NOT NULL DEFAULT false,
  is_billing_contact  boolean NOT NULL DEFAULT false,
  linkedin_url        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id)
);
CREATE INDEX contacts_company_idx ON contacts (company_id);

-- Client portal users: Client admin / Client user (3.2, 10.2 "Company settings")
CREATE TABLE company_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_admin            boolean NOT NULL DEFAULT false,
  can_view_invoices   boolean NOT NULL DEFAULT false,   -- granted to non-admins (10.3)
  invited_by          uuid REFERENCES users(id),
  invited_at          timestamptz,
  accepted_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE TABLE leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  contact_id          uuid REFERENCES contacts(id) ON DELETE SET NULL,
  stage               lead_stage NOT NULL DEFAULT 'new_lead',
  source              lead_source NOT NULL,
  heard_about_us      text,
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_term            text,
  utm_content         text,
  landing_page        text,
  referrer_url        text,
  referral_code       text,
  referrer_id         uuid REFERENCES referrers(id),
  owner_id            uuid REFERENCES users(id),           -- sales owner
  estimated_monthly_value numeric(12,2),
  first_contacted_at  timestamptz,
  qualified_at        timestamptz,
  won_at              timestamptz,
  lost_at             timestamptz,
  lost_reason         lost_reason,
  lost_reason_detail  text,
  discovery_call_at   timestamptz,
  discovery_call_url  text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  CONSTRAINT lost_requires_reason CHECK (stage <> 'lost' OR lost_reason IS NOT NULL)  -- FR-REQ-02
);
CREATE INDEX leads_stage_idx ON leads (stage);
CREATE INDEX leads_owner_idx ON leads (owner_id);
CREATE INDEX leads_company_idx ON leads (company_id);

-- Raw public-form submissions (hire form, contact form, booked call webhooks)
CREATE TABLE form_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type           text NOT NULL CHECK (form_type IN ('hire_request','contact','talent_application','referral_signup','referral_intro','booked_call')),
  locale              ui_language NOT NULL DEFAULT 'en',
  payload             jsonb NOT NULL,
  lead_id             uuid REFERENCES leads(id) ON DELETE SET NULL,
  ip                  inet,
  user_agent          text,
  captcha_score       numeric(4,3),
  processed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 7. Talents & vetting (6.1, 8.5, 9, 11 "Talents (ATS)")
-- -----------------------------------------------------------------------------

CREATE TABLE talents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  first_name          text NOT NULL,
  last_name           text NOT NULL,
  email               citext NOT NULL,
  phone               text,
  whatsapp            text,
  city                text,
  country_code        char(2) NOT NULL DEFAULT 'DZ',
  headline            text,
  summary             text,
  category_id         uuid REFERENCES job_categories(id),
  job_role_id         uuid REFERENCES job_roles(id),
  seniority           seniority_level,               -- set by agency at approval
  years_experience    numeric(4,1),
  linkedin_url        text,
  github_url          text,
  portfolio_url       text,
  expected_pay        numeric(12,2),                 -- €/month net
  current_pay         numeric(12,2),
  agreed_pay          numeric(12,2),                 -- set at vetting approval (Finance editable)
  pay_currency        char(3) NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  availability_date   date,
  notice_period_days  smallint,
  time_share_pct      smallint NOT NULL DEFAULT 100 CHECK (time_share_pct IN (50, 100)),
  vetting_stage       vetting_stage NOT NULL DEFAULT 'applied',
  status              talent_status NOT NULL DEFAULT 'in_vetting',
  vetting_score       numeric(5,2) CHECK (vetting_score BETWEEN 0 AND 100),
  vetted_at           timestamptz,
  vetted_by           uuid REFERENCES users(id),
  rejected_at         timestamptz,
  reject_category     reject_category,
  reject_reason       text,
  can_reapply_after   date,                          -- FR-TAL-03 (+6 months)
  -- Public showcase (FR-TAL-04)
  showcase_opt_in     boolean NOT NULL DEFAULT false,
  showcase_consent_at timestamptz,
  showcase_published  boolean NOT NULL DEFAULT false,
  public_slug         text UNIQUE,
  public_display_name text,                          -- "Yacine B."
  photo_file_id       uuid REFERENCES files(id),
  photo_consent_at    timestamptz,
  show_indicative_price boolean NOT NULL DEFAULT false,
  -- Payout details
  payout_method       payment_method,
  payout_currency     char(3) REFERENCES currencies(code),
  payout_details      jsonb NOT NULL DEFAULT '{}',   -- encrypted at app level
  -- Flags
  is_blacklisted      boolean NOT NULL DEFAULT false,
  blacklist_reason    text,
  last_activity_at    timestamptz,                   -- inactive after 60 days
  profile_completeness smallint NOT NULL DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
  recruiter_id        uuid REFERENCES users(id),
  merged_into_id      uuid REFERENCES talents(id),   -- duplicate merge (FR-TAL-03)
  anonymised_at       timestamptz,
  deleted_at          timestamptz,
  search_vector       tsvector,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  CONSTRAINT showcase_rules CHECK (
    NOT showcase_published
    OR (vetting_stage = 'vetted' AND showcase_opt_in AND showcase_consent_at IS NOT NULL AND public_slug IS NOT NULL)
  ),
  CONSTRAINT blacklist_status CHECK (NOT is_blacklisted OR status = 'blacklisted')
);
CREATE UNIQUE INDEX talents_email_uniq ON talents (email) WHERE merged_into_id IS NULL AND deleted_at IS NULL;
CREATE INDEX talents_phone_idx   ON talents (phone);
CREATE INDEX talents_status_idx  ON talents (status, vetting_stage);
CREATE INDEX talents_role_idx    ON talents (job_role_id, seniority);
CREATE INDEX talents_search_idx  ON talents USING gin (search_vector);

CREATE TABLE talent_skills (
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  skill_id            uuid NOT NULL REFERENCES skills(id),
  level               skill_level NOT NULL DEFAULT 'intermediate',
  years               numeric(4,1),
  is_top_skill        boolean NOT NULL DEFAULT false,   -- top 4 on public card
  verified_score      smallint CHECK (verified_score BETWEEN 0 AND 100),
  PRIMARY KEY (talent_id, skill_id)
);
CREATE INDEX talent_skills_skill_idx ON talent_skills (skill_id);

CREATE TABLE talent_languages (
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  language_code       text NOT NULL REFERENCES languages(code),
  level               cefr_level NOT NULL,
  PRIMARY KEY (talent_id, language_code)
);

CREATE TABLE talent_experiences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  company_name        text NOT NULL,
  public_company_label text,                          -- "Fintech scale-up, France"
  hide_company_name   boolean NOT NULL DEFAULT true,
  title               text NOT NULL,
  country_code        char(2),
  is_remote           boolean,
  start_date          date NOT NULL,
  end_date            date,
  description         text,
  technologies        text[] NOT NULL DEFAULT '{}',
  sort_order          smallint NOT NULL DEFAULT 0
);

CREATE TABLE talent_educations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  institution         text NOT NULL,
  degree              text,
  field_of_study      text,
  start_year          smallint,
  end_year            smallint
);

CREATE TABLE talent_certifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  name                text NOT NULL,
  issuer              text,
  issued_on           date,
  expires_on          date,
  credential_url      text
);

CREATE TABLE talent_portfolio_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  title               text NOT NULL,
  url                 text,
  file_id             uuid REFERENCES files(id),
  thumbnail_file_id   uuid REFERENCES files(id),
  description         text,
  is_public           boolean NOT NULL DEFAULT false,
  sort_order          smallint NOT NULL DEFAULT 0
);

CREATE TABLE talent_references (                     -- step 6 of vetting
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  name                text NOT NULL,
  company             text,
  relationship        text,
  email               citext,
  phone               text,
  contacted_at        timestamptz,
  feedback            text,
  rating              smallint CHECK (rating BETWEEN 1 AND 5),
  checked_by          uuid REFERENCES users(id)
);

CREATE TABLE talent_tags (
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  tag_id              uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (talent_id, tag_id)
);

-- Talent documents with expiry (9.2 "Documents")
CREATE TABLE talent_documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  file_id             uuid NOT NULL REFERENCES files(id),
  type                document_type NOT NULL,
  label               text,
  expires_on          date,
  is_current          boolean NOT NULL DEFAULT true,
  verified_by         uuid REFERENCES users(id),
  verified_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX talent_documents_talent_idx ON talent_documents (talent_id, type);

-- Vetting steps (one row per step attempt)
CREATE TABLE vetting_steps (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id) ON DELETE CASCADE,
  type                vetting_step_type NOT NULL,
  status              vetting_step_status NOT NULL DEFAULT 'pending',
  scheduled_at        timestamptz,
  completed_at        timestamptz,
  deadline_at         timestamptz,                   -- technical test: +5 days
  reviewer_id         uuid REFERENCES users(id),
  test_provider       text,                          -- CodinGame, TestGorilla, internal
  test_link           text,
  test_result_url     text,
  meeting_link        text,
  score               numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  notes               text,                          -- internal, never shown to talent
  talent_visible_summary text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id)
);
CREATE INDEX vetting_steps_talent_idx ON vetting_steps (talent_id, type);

CREATE TABLE scorecards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vetting_step_id     uuid NOT NULL REFERENCES vetting_steps(id) ON DELETE CASCADE,
  reviewer_id         uuid NOT NULL REFERENCES users(id),
  total_score         numeric(5,2) NOT NULL CHECK (total_score BETWEEN 0 AND 100),
  recommendation      recommendation NOT NULL,
  strengths           text,
  concerns            text,
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vetting_step_id, reviewer_id)
);

CREATE TABLE scorecard_scores (
  scorecard_id        uuid NOT NULL REFERENCES scorecards(id) ON DELETE CASCADE,
  criterion           text NOT NULL,                 -- skill or criterion name
  skill_id            uuid REFERENCES skills(id),
  score               smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  comment             text,
  PRIMARY KEY (scorecard_id, criterion)
);

-- -----------------------------------------------------------------------------
-- 8. Talent requests, matching, shortlists, opportunities, interviews (6.2, 8.1, 10, 11)
-- -----------------------------------------------------------------------------

CREATE TABLE talent_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id             uuid REFERENCES leads(id) ON DELETE SET NULL,
  requested_by_contact_id uuid REFERENCES contacts(id),
  source_talent_id    uuid REFERENCES talents(id),   -- "Request this profile"
  replaces_placement_id uuid,                        -- replacement request (FK after placements)
  engagement_model    engagement_model NOT NULL,
  category_id         uuid REFERENCES job_categories(id),
  job_role_id         uuid REFERENCES job_roles(id),
  role_title          text,
  seniority           seniority_level,
  talents_count       smallint NOT NULL DEFAULT 1 CHECK (talents_count > 0),
  timezone_overlap_hours smallint CHECK (timezone_overlap_hours BETWEEN 0 AND 12),
  start_window        start_window,
  desired_start_date  date,
  duration            duration_bucket,
  time_share_pct      smallint NOT NULL DEFAULT 100 CHECK (time_share_pct IN (50, 100)),
  budget_min          numeric(12,2),
  budget_max          numeric(12,2),
  budget_currency     char(3) REFERENCES currencies(code),
  indicative_price_min numeric(12,2),                -- shown on thank-you screen
  indicative_price_max numeric(12,2),
  description         text,
  status              request_status NOT NULL DEFAULT 'open',
  recruiter_id        uuid REFERENCES users(id),
  qualified_at        timestamptz,
  sla_deadline_at     timestamptz,                   -- qualified_at + 48 business hours
  sla_warned_24h_at   timestamptz,
  sla_warned_40h_at   timestamptz,
  first_shortlist_at  timestamptz,
  closed_at           timestamptz,
  lost_reason         lost_reason,
  cancelled_reason    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  CHECK (budget_max IS NULL OR budget_min IS NULL OR budget_max >= budget_min),
  CHECK (status <> 'lost' OR lost_reason IS NOT NULL)
);
CREATE INDEX talent_requests_company_idx ON talent_requests (company_id);
CREATE INDEX talent_requests_status_idx  ON talent_requests (status, sla_deadline_at);

CREATE TABLE talent_request_skills (
  request_id          uuid NOT NULL REFERENCES talent_requests(id) ON DELETE CASCADE,
  skill_id            uuid NOT NULL REFERENCES skills(id),
  is_required         boolean NOT NULL DEFAULT true,  -- required vs nice-to-have
  min_level           skill_level,
  PRIMARY KEY (request_id, skill_id)
);

CREATE TABLE talent_request_languages (
  request_id          uuid NOT NULL REFERENCES talent_requests(id) ON DELETE CASCADE,
  language_code       text NOT NULL REFERENCES languages(code),
  min_level           cefr_level NOT NULL DEFAULT 'B2',
  PRIMARY KEY (request_id, language_code)
);

CREATE TABLE shortlists (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid NOT NULL REFERENCES talent_requests(id) ON DELETE CASCADE,
  version             smallint NOT NULL DEFAULT 1,
  status              shortlist_status NOT NULL DEFAULT 'draft',
  published_at        timestamptz,
  published_by        uuid REFERENCES users(id),
  pdf_file_id         uuid REFERENCES files(id),     -- MVP: anonymised PDF sent by email
  share_token_hash    text UNIQUE,                   -- secure link (Phase 3)
  share_expires_at    timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  UNIQUE (request_id, version)
);

CREATE TABLE shortlist_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id        uuid NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
  talent_id           uuid NOT NULL REFERENCES talents(id),
  match_score         numeric(5,2) CHECK (match_score BETWEEN 0 AND 100),
  match_breakdown     jsonb,                         -- {"skills":..,"seniority":..,...}
  recruiter_note      text,                          -- "why this match"
  proposed_client_price numeric(12,2),
  proposed_currency   char(3) REFERENCES currencies(code),
  anonymised_profile_file_id uuid REFERENCES files(id),
  -- Talent side (opportunity accept/decline, 9.2)
  talent_response     talent_response NOT NULL DEFAULT 'pending',
  talent_responded_at timestamptz,
  talent_decline_reason text,
  -- Client side
  client_decision     client_decision NOT NULL DEFAULT 'pending',
  client_decision_reason text,
  client_decided_by   uuid REFERENCES users(id),
  client_decided_at   timestamptz,
  client_comment      text,
  contact_revealed_at timestamptz,                   -- FR-SEC-01: full name shown after interview booked
  sort_order          smallint NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shortlist_id, talent_id)
);
CREATE INDEX shortlist_items_talent_idx ON shortlist_items (talent_id);

CREATE TABLE interviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          uuid NOT NULL REFERENCES talent_requests(id) ON DELETE CASCADE,
  shortlist_item_id   uuid REFERENCES shortlist_items(id) ON DELETE SET NULL,
  talent_id           uuid NOT NULL REFERENCES talents(id),
  company_id          uuid NOT NULL REFERENCES companies(id),
  round               smallint NOT NULL DEFAULT 1,
  status              interview_status NOT NULL DEFAULT 'proposed',
  starts_at           timestamptz,
  ends_at             timestamptz,
  timezone            text,
  meeting_provider    text CHECK (meeting_provider IN ('google_meet','zoom','teams','other')),
  meeting_link        text,
  external_event_id   text,                          -- Cal.com / Calendly / Google event id
  prep_notes          text,                          -- for the talent
  recruiter_id        uuid REFERENCES users(id),
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  cancelled_reason    text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX interviews_starts_idx ON interviews (starts_at);
CREATE INDEX interviews_talent_idx ON interviews (talent_id);

CREATE TABLE interview_slots (                       -- slots proposed by talents / client
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id        uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  proposed_by         uuid REFERENCES users(id),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz NOT NULL,
  is_selected         boolean NOT NULL DEFAULT false
);

CREATE TABLE interview_participants (
  interview_id        uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  contact_id          uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (interview_id, contact_id)
);

CREATE TABLE interview_feedback (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id        uuid NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  author_user_id      uuid NOT NULL REFERENCES users(id),
  side                text NOT NULL CHECK (side IN ('client','talent','agency')),
  rating              smallint CHECK (rating BETWEEN 1 AND 5),
  strengths           text,
  concerns            text,
  decision            interview_decision,
  shared_with_talent  text,                          -- summary only (9.3)
  submitted_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, author_user_id)
);

-- -----------------------------------------------------------------------------
-- 9. Placements (5.2 – 5.5, 6.3, FR-PRICE-*, FR-PLC-*, FR-TAL-02)
-- -----------------------------------------------------------------------------

CREATE SEQUENCE placement_ref_seq;

CREATE TABLE placements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference           text NOT NULL UNIQUE DEFAULT ('PLC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('placement_ref_seq')::text, 5, '0')),
  company_id          uuid NOT NULL REFERENCES companies(id),
  talent_id           uuid NOT NULL REFERENCES talents(id),
  request_id          uuid REFERENCES talent_requests(id),
  shortlist_item_id   uuid REFERENCES shortlist_items(id),
  legal_entity_id     uuid NOT NULL REFERENCES legal_entities(id),
  account_manager_id  uuid REFERENCES users(id),
  client_manager_contact_id uuid REFERENCES contacts(id),
  engagement_model    engagement_model NOT NULL,
  job_role_id         uuid REFERENCES job_roles(id),
  seniority           seniority_level,
  time_share_pct      smallint NOT NULL DEFAULT 100 CHECK (time_share_pct IN (50, 100)),
  status              placement_status NOT NULL DEFAULT 'draft',
  -- Dates
  start_date          date,
  trial_end_date      date,                          -- start + 10 working days
  trial_decision      text CHECK (trial_decision IN ('keep','replace')),
  trial_decision_at   timestamptz,
  commitment_months   smallint,                      -- 6 / 12 for discounts
  planned_end_date    date,
  end_date            date,
  renewal_date        date,
  notice_given_at     date,
  notice_given_by     notice_party,
  notice_period_days  smallint NOT NULL DEFAULT 30,
  notice_end_date     date,
  end_reason          text,
  -- Pricing snapshot (FR-PRICE-03: never recalculated from the rate card after signature)
  rate_card_version_id uuid REFERENCES rate_card_versions(id),
  currency            char(3) NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  talent_pay          numeric(12,2) NOT NULL CHECK (talent_pay >= 0),     -- monthly net
  talent_daily_pay    numeric(12,2),
  target_margin_pct   numeric(5,2),
  skill_premium_pct   numeric(5,2) NOT NULL DEFAULT 0,
  client_price        numeric(12,2) NOT NULL CHECK (client_price > 0),    -- monthly list price
  price_overridden    boolean NOT NULL DEFAULT false,
  discount_pct        numeric(5,2) NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 12), -- FR-PRICE-04
  applied_discount_codes text[] NOT NULL DEFAULT '{}',
  hourly_rate         numeric(12,2),                 -- T&M
  daily_rate          numeric(12,2),
  client_price_net    numeric(12,2) GENERATED ALWAYS AS (round(client_price * (1 - discount_pct / 100), 2)) STORED,
  margin_amount       numeric(12,2) GENERATED ALWAYS AS (round(client_price * (1 - discount_pct / 100), 2) - talent_pay) STORED,
  margin_pct          numeric(6,2)  GENERATED ALWAYS AS (
                        round((client_price * (1 - discount_pct / 100) - talent_pay) / (client_price * (1 - discount_pct / 100)) * 100, 2)
                      ) STORED,
  floor_margin_pct    numeric(5,2) NOT NULL DEFAULT 25,
  margin_override_approved_by uuid REFERENCES users(id),  -- Super admin (FR-PRICE-02)
  margin_override_approved_at timestamptz,
  margin_override_reason text,
  -- Replacement / buy-out
  replaces_placement_id uuid REFERENCES placements(id),
  replaced_by_placement_id uuid REFERENCES placements(id),
  is_free_replacement boolean NOT NULL DEFAULT false,
  replacement_approved_by uuid REFERENCES users(id), -- FR-PLC-03: further replacements need sales
  buyout_fee          numeric(12,2),
  buyout_signed_at    date,
  -- Holidays / leave
  work_calendar_id    uuid REFERENCES work_calendars(id),
  paid_leave_days_per_month numeric(4,2) NOT NULL DEFAULT 2,
  bill_paid_leave     boolean NOT NULL DEFAULT false,
  -- Onboarding
  client_tools_notes  text,
  kickoff_at          timestamptz,
  first_checkin_date  date,
  is_at_risk          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  CONSTRAINT margin_floor CHECK (
    (client_price * (1 - discount_pct / 100) - talent_pay)
      >= floor_margin_pct / 100 * client_price * (1 - discount_pct / 100)
    OR margin_override_approved_by IS NOT NULL
  ),
  CONSTRAINT trial_after_start CHECK (trial_end_date IS NULL OR start_date IS NULL OR trial_end_date >= start_date),
  CONSTRAINT notice_has_party CHECK (status <> 'notice' OR (notice_given_at IS NOT NULL AND notice_given_by IS NOT NULL))
);
CREATE INDEX placements_company_idx ON placements (company_id, status);
CREATE INDEX placements_talent_idx  ON placements (talent_id, status);
-- FR-TAL-02: one full-time live placement per talent
CREATE UNIQUE INDEX placements_one_fulltime_per_talent ON placements (talent_id)
  WHERE time_share_pct = 100 AND status IN ('pending_start','in_trial','active','notice');

ALTER TABLE talent_requests ADD CONSTRAINT tr_replaces_fk FOREIGN KEY (replaces_placement_id) REFERENCES placements(id);

-- Status history for every lifecycle object (6: "logs who changed what and when")
CREATE TABLE status_history (
  id                  bigserial PRIMARY KEY,
  entity_type         text NOT NULL,                 -- placement, talent, lead, request, invoice...
  entity_id           uuid NOT NULL,
  from_status         text,
  to_status           text NOT NULL,
  reason              text,
  changed_by          uuid REFERENCES users(id),
  changed_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX status_history_entity_idx ON status_history (entity_type, entity_id, changed_at);

-- Allowed placement transitions (6.3)
CREATE TABLE placement_status_transitions (
  from_status         placement_status NOT NULL,
  to_status           placement_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);
INSERT INTO placement_status_transitions VALUES
  ('draft','pending_start'), ('draft','cancelled'),
  ('pending_start','in_trial'), ('pending_start','cancelled'),
  ('in_trial','active'), ('in_trial','ended_in_trial'),
  ('active','notice'), ('active','bought_out'),
  ('notice','ended'), ('notice','replaced');

CREATE TABLE placement_onboarding_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  code                text NOT NULL,                 -- client_contract, talent_contract, nda_ip, tools_access, kickoff, first_checkin
  label               text NOT NULL,
  owner_side          text NOT NULL CHECK (owner_side IN ('client','talent','agency')),
  is_done             boolean NOT NULL DEFAULT false,
  done_at             timestamptz,
  done_by             uuid REFERENCES users(id),
  sort_order          smallint NOT NULL DEFAULT 0,
  UNIQUE (placement_id, code)
);

CREATE TABLE check_ins (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  type                checkin_type NOT NULL,
  period_start        date NOT NULL,
  respondent_user_id  uuid REFERENCES users(id),
  score               smallint NOT NULL,
  comment             text,
  due_at              date,
  submitted_at        timestamptz,
  CHECK ((type = 'talent_monthly'   AND score BETWEEN 1 AND 5)
      OR (type = 'client_quarterly' AND score BETWEEN 0 AND 10)),
  UNIQUE (placement_id, type, period_start)
);

CREATE TABLE risk_flags (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid REFERENCES companies(id) ON DELETE CASCADE,
  placement_id        uuid REFERENCES placements(id) ON DELETE CASCADE,
  check_in_id         uuid REFERENCES check_ins(id) ON DELETE SET NULL,
  source              risk_flag_source NOT NULL,
  description         text,
  assigned_to         uuid REFERENCES users(id),
  resolved_at         timestamptz,
  resolved_by         uuid REFERENCES users(id),
  resolution_note     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR placement_id IS NOT NULL)
);

CREATE TABLE absences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  type                absence_type NOT NULL,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  days                numeric(5,2) NOT NULL CHECK (days > 0),
  is_billable         boolean NOT NULL DEFAULT false,
  is_paid_to_talent   boolean NOT NULL DEFAULT true,
  declared_by         uuid REFERENCES users(id),
  approved_by         uuid REFERENCES users(id),
  approved_at         timestamptz,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

-- Trial loss ledger (5.4 / FR-PLC-02)
CREATE TABLE trial_losses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        uuid NOT NULL UNIQUE REFERENCES placements(id),
  days_worked         numeric(5,2) NOT NULL,
  talent_cost         numeric(12,2) NOT NULL,
  currency            char(3) NOT NULL REFERENCES currencies(code),
  replacement_request_id uuid REFERENCES talent_requests(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE buyout_quotes (                         -- 5.5 / FR-PLC-04
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  months_since_start  smallint NOT NULL,
  buyout_tier_id      uuid REFERENCES buyout_tiers(id),
  multiplier          numeric(5,2) NOT NULL,
  monthly_client_price numeric(12,2) NOT NULL,
  fee                 numeric(12,2) GENERATED ALWAYS AS (round(multiplier * monthly_client_price, 2)) STORED,
  currency            char(3) NOT NULL REFERENCES currencies(code),
  requested_by        uuid REFERENCES users(id),
  status              text NOT NULL DEFAULT 'quoted' CHECK (status IN ('quoted','accepted','declined','expired')),
  valid_until         date,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Project-based engagements (milestones 30/40/30)
CREATE TABLE project_milestones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  name                text NOT NULL,
  pct_of_quote        numeric(5,2) CHECK (pct_of_quote BETWEEN 0 AND 100),
  amount              numeric(12,2) NOT NULL,
  due_date            date,
  delivered_at        timestamptz,
  accepted_at         timestamptz,
  invoice_line_id     uuid,                          -- FK after invoice_lines
  sort_order          smallint NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- 10. Contracts & e-signature (11 "Contracts", 7.1 step 8, 7.2 step 7)
-- -----------------------------------------------------------------------------

CREATE TABLE contract_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                contract_type NOT NULL,
  name                text NOT NULL,
  language            ui_language NOT NULL,
  legal_entity_id     uuid REFERENCES legal_entities(id),
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type, language, legal_entity_id)
);

CREATE TABLE contract_template_versions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         uuid NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  version             integer NOT NULL,
  body                text NOT NULL,                 -- with merge fields {{client.name}}
  merge_fields        text[] NOT NULL DEFAULT '{}',
  published_at        timestamptz,
  created_by          uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);

CREATE TABLE contracts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type                contract_type NOT NULL,
  template_version_id uuid REFERENCES contract_template_versions(id),
  legal_entity_id     uuid REFERENCES legal_entities(id),
  placement_id        uuid REFERENCES placements(id) ON DELETE SET NULL,
  company_id          uuid REFERENCES companies(id) ON DELETE SET NULL,
  talent_id           uuid REFERENCES talents(id) ON DELETE SET NULL,
  parent_contract_id  uuid REFERENCES contracts(id),  -- order form under an MSA
  title               text NOT NULL,
  file_id             uuid REFERENCES files(id),
  signed_file_id      uuid REFERENCES files(id),
  signature_provider  text,                          -- yousign, docusign, dropbox_sign, manual_upload
  provider_envelope_id text,
  signature_status    signature_status NOT NULL DEFAULT 'draft',
  sent_at             timestamptz,
  reminder_sent_at    timestamptz,
  fully_signed_at     timestamptz,
  effective_date      date,
  expiry_date         date,
  non_solicit_months  smallint DEFAULT 12,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  CHECK (placement_id IS NOT NULL OR company_id IS NOT NULL OR talent_id IS NOT NULL)
);
CREATE INDEX contracts_placement_idx ON contracts (placement_id);

CREATE TABLE contract_signatories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  party               text NOT NULL CHECK (party IN ('agency','client','talent')),
  user_id             uuid REFERENCES users(id),
  name                text NOT NULL,
  email               citext NOT NULL,
  signing_order       smallint NOT NULL DEFAULT 1,
  signed_at           timestamptz,
  declined_at         timestamptz,
  ip                  inet
);

-- -----------------------------------------------------------------------------
-- 11. Timesheets (6.4, 9.2, 10.2)
-- -----------------------------------------------------------------------------

CREATE TABLE timesheets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id        uuid NOT NULL REFERENCES placements(id) ON DELETE CASCADE,
  period_month        date NOT NULL CHECK (extract(day FROM period_month) = 1),
  status              timesheet_status NOT NULL DEFAULT 'draft',
  total_hours         numeric(7,2) NOT NULL DEFAULT 0,
  total_days          numeric(5,2) NOT NULL DEFAULT 0,
  submitted_at        timestamptz,
  auto_approve_at     timestamptz,                   -- submitted_at + 3 days
  approved_by         uuid REFERENCES users(id),
  approved_at         timestamptz,
  rejected_by         uuid REFERENCES users(id),
  rejected_at         timestamptz,
  rejection_comment   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, period_month),
  CHECK (status <> 'rejected' OR rejection_comment IS NOT NULL)
);

CREATE TABLE timesheet_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id        uuid NOT NULL REFERENCES timesheets(id) ON DELETE CASCADE,
  work_date           date NOT NULL,
  hours               numeric(4,2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  project_task        text,
  note                text,
  UNIQUE (timesheet_id, work_date, project_task)
);

-- -----------------------------------------------------------------------------
-- 12. Invoicing & client payments (5.1, 6.4, FR-BILL-*)
-- -----------------------------------------------------------------------------

CREATE TABLE invoice_number_sequences (               -- FR-BILL-02
  legal_entity_id     uuid NOT NULL REFERENCES legal_entities(id),
  kind                invoice_kind NOT NULL,
  fiscal_year         smallint NOT NULL,
  last_number         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (legal_entity_id, kind, fiscal_year)
);

CREATE TABLE invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                invoice_kind NOT NULL DEFAULT 'invoice',
  legal_entity_id     uuid NOT NULL REFERENCES legal_entities(id),
  company_id          uuid NOT NULL REFERENCES companies(id),
  credited_invoice_id uuid REFERENCES invoices(id),  -- for credit notes
  fiscal_year         smallint,
  sequence_number     integer,
  number              text,                          -- assigned at issue: CH-DZ-2026-0001
  status              invoice_status NOT NULL DEFAULT 'draft',
  language            ui_language NOT NULL DEFAULT 'en',
  period_start        date,
  period_end          date,
  issue_date          date,
  due_date            date,
  currency            char(3) NOT NULL REFERENCES currencies(code),
  subtotal            numeric(14,2) NOT NULL DEFAULT 0,
  discount_total      numeric(14,2) NOT NULL DEFAULT 0,
  vat_rate            numeric(5,2) NOT NULL DEFAULT 0,
  vat_amount          numeric(14,2) NOT NULL DEFAULT 0,
  total               numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(14,2) NOT NULL DEFAULT 0,
  balance_due         numeric(14,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  reverse_charge      boolean NOT NULL DEFAULT true,
  tax_mention         text,
  billing_snapshot    jsonb NOT NULL DEFAULT '{}',   -- client name/address/VAT at issue time
  bank_snapshot       jsonb NOT NULL DEFAULT '{}',   -- entity IBAN/SWIFT/Payoneer at issue time
  notes               text,
  pdf_file_id         uuid REFERENCES files(id),
  generated_automatically boolean NOT NULL DEFAULT false,
  issued_by           uuid REFERENCES users(id),
  issued_at           timestamptz,
  sent_at             timestamptz,
  paid_at             timestamptz,
  voided_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  UNIQUE (legal_entity_id, kind, fiscal_year, sequence_number),
  CHECK (kind <> 'credit_note' OR credited_invoice_id IS NOT NULL),
  CHECK (status = 'draft' OR (number IS NOT NULL AND issue_date IS NOT NULL AND due_date IS NOT NULL))
);
CREATE INDEX invoices_company_idx ON invoices (company_id, status);
CREATE INDEX invoices_due_idx     ON invoices (due_date) WHERE status IN ('issued','partially_paid','overdue');

CREATE TABLE invoice_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  placement_id        uuid REFERENCES placements(id),
  timesheet_id        uuid REFERENCES timesheets(id),
  kind                invoice_line_kind NOT NULL,
  description         text NOT NULL,
  period_start        date,
  period_end          date,
  quantity            numeric(10,2) NOT NULL DEFAULT 1,  -- days / hours / months
  unit                text NOT NULL DEFAULT 'month' CHECK (unit IN ('month','day','hour','unit')),
  unit_price          numeric(12,2) NOT NULL,
  discount_pct        numeric(5,2) NOT NULL DEFAULT 0,
  amount              numeric(14,2) NOT NULL,
  -- internal snapshot for margin reporting (never rendered on the PDF)
  talent_cost         numeric(14,2),
  sort_order          smallint NOT NULL DEFAULT 0
);
CREATE INDEX invoice_lines_placement_idx ON invoice_lines (placement_id);

ALTER TABLE project_milestones ADD CONSTRAINT pm_invoice_line_fk FOREIGN KEY (invoice_line_id) REFERENCES invoice_lines(id) ON DELETE SET NULL;

CREATE TABLE payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES invoices(id),
  received_on         date NOT NULL,
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  currency            char(3) NOT NULL REFERENCES currencies(code),
  method              payment_method NOT NULL,
  fees                numeric(12,2) NOT NULL DEFAULT 0,     -- transfer / FX fees (5.1)
  fx_rate             numeric(18,8),
  amount_in_entity_currency numeric(14,2),
  reference           text,
  provider_payment_id text,                          -- Stripe / Payoneer id
  recorded_by         uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_invoice_idx ON payments (invoice_id);

CREATE TABLE invoice_reminders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  stage               text NOT NULL CHECK (stage IN ('due','plus_3','plus_10','plus_15_flag','plus_30_block')),
  sent_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, stage)
);

-- -----------------------------------------------------------------------------
-- 13. Talent payouts (5.1, 6.4, FR-PAY-*)
-- -----------------------------------------------------------------------------

CREATE TABLE payouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_id           uuid NOT NULL REFERENCES talents(id),
  legal_entity_id     uuid REFERENCES legal_entities(id),
  period_month        date NOT NULL CHECK (extract(day FROM period_month) = 1),
  status              payout_status NOT NULL DEFAULT 'pending',
  currency            char(3) NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),  -- pay set in EUR
  gross_amount        numeric(14,2) NOT NULL DEFAULT 0,
  adjustments_total   numeric(14,2) NOT NULL DEFAULT 0,
  net_amount          numeric(14,2) NOT NULL DEFAULT 0,
  paid_currency       char(3) REFERENCES currencies(code),  -- EUR or DZD
  fx_rate             numeric(18,8),
  paid_amount         numeric(14,2),
  fees                numeric(12,2) NOT NULL DEFAULT 0,
  method              payment_method,
  transfer_reference  text,
  due_date            date,                          -- 10th of next month
  approved_by         uuid REFERENCES users(id),
  approved_at         timestamptz,
  paid_at             timestamptz,
  statement_file_id   uuid REFERENCES files(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id),
  UNIQUE (talent_id, period_month),
  CHECK (status <> 'paid' OR (paid_at IS NOT NULL AND transfer_reference IS NOT NULL AND method IS NOT NULL))
);

CREATE TABLE payout_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id           uuid NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  placement_id        uuid REFERENCES placements(id),
  kind                payout_line_kind NOT NULL,
  description         text,
  days                numeric(5,2),
  daily_rate          numeric(12,2),
  amount              numeric(14,2) NOT NULL,        -- negative for deductions
  sort_order          smallint NOT NULL DEFAULT 0
);

-- -----------------------------------------------------------------------------
-- 14. Referrals & rewards (5.6, 6.5, FR-REF-01)
-- -----------------------------------------------------------------------------

CREATE TABLE referral_clicks (
  id                  bigserial PRIMARY KEY,
  referrer_id         uuid NOT NULL REFERENCES referrers(id) ON DELETE CASCADE,
  visitor_id          text,                          -- first-party cookie id
  landing_page        text,
  ip                  inet,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id         uuid NOT NULL REFERENCES referrers(id),
  referral_kind       text NOT NULL DEFAULT 'client' CHECK (referral_kind IN ('client','talent')),
  company_id          uuid REFERENCES companies(id),
  lead_id             uuid UNIQUE REFERENCES leads(id),   -- first-touch: one referrer per lead
  referred_talent_id  uuid REFERENCES talents(id),
  intro_company_name  text,                          -- direct introduction form
  intro_contact_name  text,
  intro_contact_email citext,
  intro_need          text,
  status              referral_status NOT NULL DEFAULT 'submitted',
  attributed_at       timestamptz NOT NULL DEFAULT now(),
  attribution_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR referred_talent_id IS NOT NULL OR intro_company_name IS NOT NULL)
);
CREATE INDEX referrals_referrer_idx ON referrals (referrer_id);

ALTER TABLE companies ADD CONSTRAINT companies_referral_fk FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE SET NULL;

CREATE TABLE referral_rewards (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id         uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  reward_rule_id      uuid REFERENCES referral_reward_rules(id),
  reward_type         reward_type NOT NULL,
  amount              numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency            char(3) NOT NULL DEFAULT 'EUR' REFERENCES currencies(code),
  status              reward_status NOT NULL DEFAULT 'pending',
  paid_invoices_count smallint NOT NULL DEFAULT 0,
  trial_passed        boolean NOT NULL DEFAULT false,
  payable_at          timestamptz,
  paid_at             timestamptz,
  payment_method      payment_method,
  payment_reference   text,
  fees                numeric(12,2) NOT NULL DEFAULT 0,
  receipt_file_id     uuid REFERENCES files(id),
  cancelled_at        timestamptz,
  cancel_reason       text,
  approved_by         uuid REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'payable' OR (paid_invoices_count >= 2 AND trial_passed)),
  CHECK (status <> 'paid' OR paid_at IS NOT NULL)
);

-- -----------------------------------------------------------------------------
-- 15. Collaboration: notes, tasks, activity timeline, saved views (11)
-- -----------------------------------------------------------------------------

CREATE TABLE notes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         text NOT NULL,                 -- company, lead, talent, request, placement...
  entity_id           uuid NOT NULL,
  body                text NOT NULL,
  is_internal         boolean NOT NULL DEFAULT true,
  author_id           uuid NOT NULL REFERENCES users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_entity_idx ON notes (entity_type, entity_id);

CREATE TABLE tasks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         text,
  entity_id           uuid,
  title               text NOT NULL,
  description         text,
  due_at              timestamptz,
  status              task_status NOT NULL DEFAULT 'open',
  assignee_id         uuid REFERENCES users(id),
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id)
);
CREATE INDEX tasks_assignee_idx ON tasks (assignee_id, status, due_at);

CREATE TABLE activities (                            -- unified record timeline
  id                  bigserial PRIMARY KEY,
  entity_type         text NOT NULL,
  entity_id           uuid NOT NULL,
  activity_type       text NOT NULL,                 -- email_sent, note, status_change, file_uploaded, call
  summary             text NOT NULL,
  metadata            jsonb NOT NULL DEFAULT '{}',
  actor_id            uuid REFERENCES users(id),
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_entity_idx ON activities (entity_type, entity_id, occurred_at DESC);

CREATE TABLE entity_attachments (                    -- files on any record
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         text NOT NULL,
  entity_id           uuid NOT NULL,
  file_id             uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  document_type       document_type NOT NULL DEFAULT 'other',
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entity_attachments_idx ON entity_attachments (entity_type, entity_id);

CREATE TABLE company_tags (
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tag_id              uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (company_id, tag_id)
);

CREATE TABLE saved_views (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module              text NOT NULL,                 -- leads, talents, placements, invoices...
  name                text NOT NULL,
  filters             jsonb NOT NULL DEFAULT '{}',
  sort                jsonb NOT NULL DEFAULT '{}',
  columns             text[],
  is_shared           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module, name)
);

-- -----------------------------------------------------------------------------
-- 16. Notifications & email templates (13)
-- -----------------------------------------------------------------------------

CREATE TABLE email_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL,                 -- shortlist_ready, trial_day_8, invoice_overdue_3...
  language            ui_language NOT NULL,
  subject             text NOT NULL,
  body_html           text NOT NULL,
  body_text           text,
  variables           text[] NOT NULL DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  updated_by          uuid REFERENCES users(id),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code, language)
);

CREATE TABLE notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  recipient_email     citext,                        -- billing contacts / referrers without account
  type                text NOT NULL,
  title               text,
  payload             jsonb NOT NULL DEFAULT '{}',
  link_url            text,
  channel             notification_channel NOT NULL,
  email_template_id   uuid REFERENCES email_templates(id),
  provider_message_id text,
  sent_at             timestamptz,
  failed_at           timestamptz,
  error               text,
  read_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR recipient_email IS NOT NULL)
);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE notification_preferences (
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                text NOT NULL,
  channel             notification_channel NOT NULL,
  enabled             boolean NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, type, channel)
);

CREATE TABLE scheduled_jobs_log (                    -- cron runs: invoices, payouts, SLA, reminders
  id                  bigserial PRIMARY KEY,
  job_name            text NOT NULL,
  run_for_period      date,
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  status              text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','failed')),
  items_processed     integer NOT NULL DEFAULT 0,
  error               text
);

-- -----------------------------------------------------------------------------
-- 17. Audit log (11 "Audit log", NFR-09: kept 5 years)
-- -----------------------------------------------------------------------------

CREATE TABLE audit_log (
  id                  bigserial PRIMARY KEY,
  user_id             uuid REFERENCES users(id),
  entity_type         text NOT NULL,
  entity_id           uuid,
  action              audit_action NOT NULL,
  old_values          jsonb,
  new_values          jsonb,
  ip                  inet,
  user_agent          text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_entity_idx ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_log_user_idx   ON audit_log (user_id, created_at DESC);

-- =============================================================================
-- 18. Business-rule triggers (section 12)
--     The API sets per-request context with:
--       SET LOCAL app.user_id = '<uuid>'; SET LOCAL app.ip = '1.2.3.4';
--       SET LOCAL app.role = 'finance'; SET LOCAL app.company_id = '<uuid>'; SET LOCAL app.talent_id = '<uuid>';
-- =============================================================================

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- updated_at on every table that has the column
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb ON tb.table_name = c.table_name AND tb.table_schema = c.table_schema
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at' AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END $$;

-- Generic audit trigger (money, prices, statuses, settings)
CREATE OR REPLACE FUNCTION audit_row() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    IF v_old - 'updated_at' = v_new - 'updated_at' THEN RETURN NEW; END IF;
  ELSE v_old := to_jsonb(OLD);
  END IF;
  v_id := nullif(coalesce(v_new, v_old) ->> 'id', '')::uuid;
  INSERT INTO audit_log (user_id, entity_type, entity_id, action, old_values, new_values, ip)
  VALUES (app_user_id(), TG_TABLE_NAME, v_id,
          CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END::audit_action,
          v_old, v_new, nullif(current_setting('app.ip', true), '')::inet);
  RETURN coalesce(NEW, OLD);
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'talents','companies','leads','talent_requests','placements','contracts',
    'invoices','invoice_lines','payments','payouts','payout_lines','referral_rewards',
    'rate_card_versions','rate_card_entries','discount_rules','buyout_tiers',
    'referral_reward_rules','legal_entities','users','company_users'
  ] LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION audit_row()', t, t);
  END LOOP;
END $$;

-- settings has a text PK, audited separately
CREATE OR REPLACE FUNCTION audit_settings() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (user_id, entity_type, entity_id, action, old_values, new_values, ip)
  VALUES (app_user_id(), 'settings:' || coalesce(NEW.key, OLD.key), NULL,
          CASE TG_OP WHEN 'INSERT' THEN 'create' WHEN 'UPDATE' THEN 'update' ELSE 'delete' END::audit_action,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END,
          nullif(current_setting('app.ip', true), '')::inet);
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_settings_audit AFTER INSERT OR UPDATE OR DELETE ON settings FOR EACH ROW EXECUTE FUNCTION audit_settings();

-- Generic status history: TG_ARGV[0] = status column name
CREATE OR REPLACE FUNCTION log_status_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE col text := TG_ARGV[0]; v_old text; v_new text;
BEGIN
  v_new := to_jsonb(NEW) ->> col;
  IF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD) ->> col; END IF;
  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO status_history (entity_type, entity_id, from_status, to_status, changed_by)
    VALUES (TG_TABLE_NAME || CASE WHEN col <> 'status' THEN '.' || col ELSE '' END, NEW.id, v_old, v_new, app_user_id());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_talents_status_hist     AFTER INSERT OR UPDATE OF status        ON talents          FOR EACH ROW EXECUTE FUNCTION log_status_change('status');
CREATE TRIGGER trg_talents_vetting_hist    AFTER INSERT OR UPDATE OF vetting_stage ON talents          FOR EACH ROW EXECUTE FUNCTION log_status_change('vetting_stage');
CREATE TRIGGER trg_leads_stage_hist        AFTER INSERT OR UPDATE OF stage         ON leads            FOR EACH ROW EXECUTE FUNCTION log_status_change('stage');
CREATE TRIGGER trg_requests_status_hist    AFTER INSERT OR UPDATE OF status        ON talent_requests  FOR EACH ROW EXECUTE FUNCTION log_status_change('status');
CREATE TRIGGER trg_placements_status_hist  AFTER INSERT OR UPDATE OF status        ON placements       FOR EACH ROW EXECUTE FUNCTION log_status_change('status');
CREATE TRIGGER trg_invoices_status_hist    AFTER INSERT OR UPDATE OF status        ON invoices         FOR EACH ROW EXECUTE FUNCTION log_status_change('status');
CREATE TRIGGER trg_payouts_status_hist     AFTER INSERT OR UPDATE OF status        ON payouts          FOR EACH ROW EXECUTE FUNCTION log_status_change('status');
CREATE TRIGGER trg_timesheets_status_hist  AFTER INSERT OR UPDATE OF status        ON timesheets       FOR EACH ROW EXECUTE FUNCTION log_status_change('status');
CREATE TRIGGER trg_rewards_status_hist     AFTER INSERT OR UPDATE OF status        ON referral_rewards FOR EACH ROW EXECUTE FUNCTION log_status_change('status');
CREATE TRIGGER trg_referrals_status_hist   AFTER INSERT OR UPDATE OF status        ON referrals        FOR EACH ROW EXECUTE FUNCTION log_status_change('status');

-- 6.3: only allowed placement transitions
CREATE OR REPLACE FUNCTION check_placement_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT EXISTS (
    SELECT 1 FROM placement_status_transitions WHERE from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'Placement % cannot move from % to %', OLD.reference, OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_placement_transition BEFORE UPDATE OF status ON placements
  FOR EACH ROW EXECUTE FUNCTION check_placement_transition();

-- FR-PRICE-03: pricing frozen once the placement is signed (leaves draft)
CREATE OR REPLACE FUNCTION freeze_placement_prices() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'draft' AND (
       NEW.client_price IS DISTINCT FROM OLD.client_price
    OR NEW.talent_pay   IS DISTINCT FROM OLD.talent_pay
    OR NEW.discount_pct IS DISTINCT FROM OLD.discount_pct
    OR NEW.currency     IS DISTINCT FROM OLD.currency)
  AND current_setting('app.role', true) IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Prices of a signed placement can only be changed by a Super admin (amendment)';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_placement_freeze_prices BEFORE UPDATE ON placements
  FOR EACH ROW EXECUTE FUNCTION freeze_placement_prices();

-- FR-TAL-02: part-time total ≤ 100 %
CREATE OR REPLACE FUNCTION check_talent_capacity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE total int;
BEGIN
  IF NEW.status IN ('pending_start','in_trial','active','notice') THEN
    SELECT coalesce(sum(time_share_pct), 0) INTO total
    FROM placements
    WHERE talent_id = NEW.talent_id AND id <> NEW.id
      AND status IN ('pending_start','in_trial','active','notice');
    IF total + NEW.time_share_pct > 100 THEN
      RAISE EXCEPTION 'Talent % would exceed 100%% allocation (% %%)', NEW.talent_id, total + NEW.time_share_pct;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_placement_capacity BEFORE INSERT OR UPDATE OF status, time_share_pct, talent_id ON placements
  FOR EACH ROW EXECUTE FUNCTION check_talent_capacity();

-- FR-TAL-01: only vetted / available talents in a shortlist
CREATE OR REPLACE FUNCTION check_shortlist_talent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM talents
    WHERE id = NEW.talent_id AND vetting_stage = 'vetted'
      AND status IN ('available','proposed') AND NOT is_blacklisted
  ) THEN
    RAISE EXCEPTION 'Only vetted, available talents can be shortlisted';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_shortlist_talent BEFORE INSERT ON shortlist_items
  FOR EACH ROW EXECUTE FUNCTION check_shortlist_talent();

-- FR-REF-01: self-referral blocked
CREATE OR REPLACE FUNCTION check_self_referral() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM referrers r WHERE r.id = NEW.referrer_id AND r.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'A referrer cannot refer their own company';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_self_referral BEFORE INSERT OR UPDATE OF company_id, referrer_id ON referrals
  FOR EACH ROW EXECUTE FUNCTION check_self_referral();

-- FR-BILL-02: sequential numbering per legal entity / kind / year, assigned at issue
CREATE OR REPLACE FUNCTION assign_invoice_number() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_year smallint; v_seq int; v_prefix text;
BEGIN
  IF OLD.status = 'draft' AND NEW.status <> 'draft' AND NEW.status <> 'void' AND NEW.number IS NULL THEN
    NEW.issue_date := coalesce(NEW.issue_date, current_date);
    v_year := extract(year FROM NEW.issue_date);
    INSERT INTO invoice_number_sequences (legal_entity_id, kind, fiscal_year, last_number)
    VALUES (NEW.legal_entity_id, NEW.kind, v_year, 1)
    ON CONFLICT (legal_entity_id, kind, fiscal_year)
      DO UPDATE SET last_number = invoice_number_sequences.last_number + 1
    RETURNING last_number INTO v_seq;
    SELECT CASE WHEN NEW.kind = 'credit_note' THEN invoice_prefix || '-' || credit_note_prefix ELSE invoice_prefix END
      INTO v_prefix FROM legal_entities WHERE id = NEW.legal_entity_id;
    NEW.fiscal_year := v_year;
    NEW.sequence_number := v_seq;
    NEW.number := v_prefix || '-' || v_year || '-' || lpad(v_seq::text, 5, '0');
    NEW.issued_at := now();
    NEW.issued_by := coalesce(NEW.issued_by, app_user_id());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invoice_number BEFORE UPDATE OF status ON invoices
  FOR EACH ROW EXECUTE FUNCTION assign_invoice_number();

-- FR-BILL-02: issued invoices are immutable (only payment / status fields may change)
CREATE OR REPLACE FUNCTION protect_issued_invoice() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  allowed text[] := ARRAY['status','amount_paid','balance_due','paid_at','sent_at','voided_at',
                          'pdf_file_id','updated_at','number','fiscal_year','sequence_number',
                          'issued_at','issued_by','issue_date'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' THEN RAISE EXCEPTION 'Issued invoice % cannot be deleted; use a credit note', OLD.number; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status <> 'draft' AND (to_jsonb(OLD) - allowed) <> (to_jsonb(NEW) - allowed) THEN
    RAISE EXCEPTION 'Issued invoice % cannot be edited; use a credit note', OLD.number;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invoice_protect BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION protect_issued_invoice();

CREATE OR REPLACE FUNCTION protect_issued_invoice_lines() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_status invoice_status;
BEGIN
  SELECT status INTO v_status FROM invoices WHERE id = coalesce(NEW.invoice_id, OLD.invoice_id);
  IF v_status IS NOT NULL AND v_status <> 'draft' THEN
    RAISE EXCEPTION 'Lines of an issued invoice cannot be changed';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_invoice_lines_protect BEFORE INSERT OR UPDATE OR DELETE ON invoice_lines
  FOR EACH ROW EXECUTE FUNCTION protect_issued_invoice_lines();

-- Payments keep invoice.amount_paid / status in sync
CREATE OR REPLACE FUNCTION sync_invoice_payments() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_invoice uuid := coalesce(NEW.invoice_id, OLD.invoice_id); v_paid numeric; v_total numeric;
BEGIN
  SELECT coalesce(sum(amount), 0) INTO v_paid FROM payments WHERE invoice_id = v_invoice;
  SELECT total INTO v_total FROM invoices WHERE id = v_invoice;
  UPDATE invoices SET
    amount_paid = v_paid,
    status = CASE WHEN v_paid >= v_total THEN 'paid'
                  WHEN v_paid > 0 THEN 'partially_paid'
                  ELSE status END,
    paid_at = CASE WHEN v_paid >= v_total THEN now() ELSE NULL END
  WHERE id = v_invoice AND status <> 'void';
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_payments_sync AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION sync_invoice_payments();

-- 6.3: low check-in (≤ 2) or NPS (≤ 6) opens a risk flag
CREATE OR REPLACE FUNCTION checkin_risk_flag() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.submitted_at IS NOT NULL AND (
       (NEW.type = 'talent_monthly'   AND NEW.score <= 2)
    OR (NEW.type = 'client_quarterly' AND NEW.score <= 6)) THEN
    INSERT INTO risk_flags (placement_id, company_id, check_in_id, source, description, assigned_to)
    SELECT p.id, p.company_id, NEW.id,
           CASE NEW.type WHEN 'talent_monthly' THEN 'low_checkin' ELSE 'low_nps' END::risk_flag_source,
           'Score ' || NEW.score || coalesce(': ' || NEW.comment, ''), p.account_manager_id
    FROM placements p WHERE p.id = NEW.placement_id;
    UPDATE placements SET is_at_risk = true WHERE id = NEW.placement_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_checkin_risk AFTER INSERT OR UPDATE OF submitted_at, score ON check_ins
  FOR EACH ROW EXECUTE FUNCTION checkin_risk_flag();

-- =============================================================================
-- 19. Role-scoped views (FR-SEC-01 / FR-SEC-02, 9.3, 10.3)
-- =============================================================================

-- Client portal: never exposes talent pay or margin, nor personal contact details
CREATE VIEW v_client_placements AS
SELECT p.id, p.reference, p.company_id, p.talent_id,
       t.first_name, t.last_name,                     -- shown: interview already happened
       jr.name_en AS role_name, p.seniority, p.engagement_model, p.time_share_pct,
       p.status, p.start_date, p.trial_end_date, p.notice_end_date, p.end_date,
       p.currency, p.client_price, p.discount_pct, p.client_price_net, p.hourly_rate, p.daily_rate,
       (SELECT c.score FROM check_ins c WHERE c.placement_id = p.id AND c.type = 'client_quarterly'
        ORDER BY c.period_start DESC LIMIT 1) AS last_client_nps
FROM placements p
JOIN talents t ON t.id = p.talent_id
LEFT JOIN job_roles jr ON jr.id = p.job_role_id;

-- Talent portal: never exposes client price or margin
CREATE VIEW v_talent_placements AS
SELECT p.id, p.reference, p.talent_id, p.company_id, co.name AS client_name, co.industry,
       p.engagement_model, p.time_share_pct, p.status, p.start_date, p.trial_end_date,
       p.notice_period_days, p.notice_end_date, p.end_date,
       p.currency, p.talent_pay, p.talent_daily_pay, p.paid_leave_days_per_month
FROM placements p
JOIN companies co ON co.id = p.company_id;

-- Client shortlist: anonymised until an interview is booked
CREATE VIEW v_client_shortlist_items AS
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

-- Public showcase (8.2): anonymised, opted-in, vetted only
CREATE VIEW v_public_talents AS
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

-- Finance / Super admin: gross & contribution margin per placement (5.7)
CREATE VIEW v_placement_economics AS
SELECT p.id, p.reference, p.company_id, p.talent_id, p.status, p.currency,
       p.client_price_net, p.talent_pay, p.margin_amount, p.margin_pct,
       coalesce(inv.revenue, 0)             AS revenue_invoiced,
       coalesce(inv.talent_cost, 0)         AS talent_cost_accrued,
       coalesce(po.paid_to_talent, 0)       AS talent_paid,
       round(coalesce(fees.payment_fees, 0), 2) AS payment_fees,
       round(coalesce(rw.referral_cost, 0), 2)  AS referral_cost,   -- company reward split across its placements
       coalesce(tl.trial_loss, 0)           AS trial_loss,
       round(coalesce(inv.revenue, 0) - coalesce(inv.talent_cost, 0) - coalesce(fees.payment_fees, 0)
         - coalesce(rw.referral_cost, 0) - coalesce(tl.trial_loss, 0), 2) AS contribution_margin
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

-- Dashboard KPIs (11.2)
CREATE VIEW v_kpi_mrr AS
SELECT currency,
       count(*)                                   AS active_placements,
       sum(client_price_net)                      AS mrr,
       sum(margin_amount)                         AS monthly_gross_margin,
       round(sum(margin_amount) / nullif(sum(client_price_net), 0) * 100, 2) AS gross_margin_pct
FROM placements
WHERE status IN ('in_trial','active','notice')
GROUP BY currency;

CREATE VIEW v_invoice_aging AS
SELECT i.id, i.number, i.company_id, i.currency, i.total, i.balance_due, i.due_date,
       greatest(current_date - i.due_date, 0) AS days_overdue,
       CASE WHEN i.due_date >= current_date THEN 'not_due'
            WHEN current_date - i.due_date <= 15 THEN '1_15'
            WHEN current_date - i.due_date <= 30 THEN '16_30'
            ELSE '30_plus' END AS bucket
FROM invoices i
WHERE i.kind = 'invoice' AND i.status IN ('issued','partially_paid','overdue');

-- =============================================================================
-- 20. Row-level security for portal access (client = own company, talent = self)
--     Staff connect with a role that bypasses RLS or set app.role to a staff role.
-- =============================================================================

CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.role', true) IN ('recruiter','recruiter_lead','sales','account_manager','finance','super_admin')
$$;

ALTER TABLE talent_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY tr_access ON talent_requests USING (
  app_is_staff() OR company_id = nullif(current_setting('app.company_id', true), '')::uuid);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY inv_access ON invoices USING (
  app_is_staff()
  OR (status <> 'draft' AND company_id = nullif(current_setting('app.company_id', true), '')::uuid));

ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY ts_access ON timesheets USING (
  app_is_staff() OR EXISTS (
    SELECT 1 FROM placements p WHERE p.id = timesheets.placement_id
      AND (p.company_id = nullif(current_setting('app.company_id', true), '')::uuid
        OR p.talent_id  = nullif(current_setting('app.talent_id',  true), '')::uuid)));

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY po_access ON payouts USING (
  app_is_staff() OR talent_id = nullif(current_setting('app.talent_id', true), '')::uuid);

-- =============================================================================
-- 21. Seed data (proposed defaults from section 5 — editable in Settings)
-- =============================================================================

INSERT INTO currencies (code, name, symbol, is_client_currency) VALUES
  ('EUR', 'Euro', '€', true), ('USD', 'US Dollar', '$', false),
  ('GBP', 'Pound Sterling', '£', false), ('DZD', 'Algerian Dinar', 'DA', false);

INSERT INTO languages (code, name) VALUES
  ('en', 'English'), ('fr', 'French'), ('ar', 'Arabic'), ('de', 'German'), ('es', 'Spanish');

INSERT INTO rate_card_versions (id, label, valid_from, is_current)
VALUES ('00000000-0000-0000-0000-000000000001', 'Launch rate card', current_date, true);

INSERT INTO rate_card_entries (rate_card_version_id, seniority, min_years, max_years, talent_net_pay, target_margin_pct) VALUES
  ('00000000-0000-0000-0000-000000000001', 'junior', 1, 2,    700,  44),
  ('00000000-0000-0000-0000-000000000001', 'mid',    3, 5,   1200,  40),
  ('00000000-0000-0000-0000-000000000001', 'senior', 5, 8,   2000,  37.5),
  ('00000000-0000-0000-0000-000000000001', 'lead',   8, NULL, 2800, 35);

INSERT INTO discount_rules (code, label, discount_pct, min_talents, min_commitment_months) VALUES
  ('team_3_plus', 'Team of 3+ talents',        5, 3, NULL),
  ('commit_6m',   '6-month commitment',         5, NULL, 6),
  ('commit_12m',  '12-month commitment (annual)', 10, NULL, 12);

INSERT INTO buyout_tiers (from_month, to_month, multiplier) VALUES
  (0, 6, 3), (6, 12, 2), (12, 24, 1), (24, NULL, 0);

INSERT INTO referral_reward_rules (reward_type, base_amount, per_extra_talent_amount, extra_talent_threshold) VALUES
  ('monthly_plan', 300, 0, NULL),
  ('team',         500, 100, 3),
  ('annual_plan', 1000, 0, NULL),
  ('talent_referral', 100, 0, NULL);

INSERT INTO settings (key, value, description) VALUES
  ('trial.working_days',            '10',   'Trial length (5.4)'),
  ('trial.ask_decision_on_day',     '8',    'Keep or replace prompt (FR-PLC-01)'),
  ('replacement.free_months',       '3',    'Free replacement window (FR-PLC-03)'),
  ('notice.client_days',            '30',   'Default client notice'),
  ('notice.talent_days',            '30',   'Default talent notice'),
  ('sla.shortlist_business_hours',  '48',   'FR-REQ-01'),
  ('sla.warn_recruiter_hours',      '24',   'FR-REQ-01'),
  ('sla.warn_lead_hours',           '40',   'FR-REQ-01'),
  ('billing.dedicated_due_days',    '7',    '5.1'),
  ('billing.tm_due_days',           '15',   '5.1'),
  ('billing.overdue_flag_days',     '15',   'FR-BILL-03'),
  ('billing.block_requests_days',   '30',   'FR-BILL-03'),
  ('timesheet.auto_approve_days',   '3',    '6.4'),
  ('payout.day_of_month',           '10',   'FR-PAY-01'),
  ('talent.reapply_months',         '6',    'FR-TAL-03'),
  ('talent.inactive_after_days',    '60',   '6.1'),
  ('talent.technical_test_days',    '5',    '6.1'),
  ('gdpr.rejected_retention_months','24',   'NFR-04'),
  ('audit.retention_years',         '5',    'NFR-09'),
  ('matching.weights', '{"skills":50,"seniority":20,"availability":15,"language":10,"vetting":5}', 'Match score weights (11.2)'),
  ('showcase.show_from_price',      'false','Show "from €X/month" on public cards');

COMMIT;
