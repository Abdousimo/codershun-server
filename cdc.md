
# CDC — IT Staffing Platform (Coders Hub)


This CDC (Cahier des Charges) turns the market study and the Coders Hub home-page mockup into a buildable specification: pages, content, features, data and acceptance rules for an IT staff augmentation platform exporting Algerian tech talent.

**Contents**

1. Project context and objectives
2. Scope and delivery phases
3. Users, personas and roles
4. Platform map: pages and modules
5. Pricing, money flow and who pays what
6. Core processes and status lifecycles
7. User journeys
8. Public pages (excluding the landing page)
9. Talent dashboard
10. Client dashboard
11. Admin back-office
12. Business rules
13. Notifications and emails
14. Data model
15. Non-functional requirements
16. Technical architecture and integrations
17. Roadmap, deliverables and acceptance

**Conventions.** The landing page already exists and is not specified here. Requirement IDs follow `FR-<module>-<nn>` (functional) and `NFR-<nn>` (non-functional). Priority: **M** = Must (MVP), **S** = Should (Phase 2), **C** = Could (Phase 3). All amounts and percentages are proposals to validate with the founders and the accountant; the platform must store them as settings, never hard-coded.

## 1. Project context and objectives

The platform must let a foreign company request, interview and hire pre-vetted Algerian tech talent within 48 hours of a qualified request, while the agency invoices monthly and keeps a recurring margin.

### 1.1 Business model recap

Client company → Staffing company (the platform) → Talent. The client pays a monthly fee per talent; the agency pays the talent and keeps the margin.

| Item | Example amount | Share of client price |
|---|---|---|
| Market rate (direct hire by client) | €4,000/month | — |
| Price invoiced by the agency | €2,000/month | 100 % |
| Paid to the talent | €1,200/month | 60 % |
| Agency gross margin | €800/month | 40 % |

Supported engagement models: Time & Material (hourly/daily), Dedicated Developer (monthly retainer), Team Extension, Dedicated Team, Project Based (secondary), and a placement fee ("try before you hire" / buy-out).

### 1.2 Product objectives

| # | Objective | Measured by | Target (12 months) |
|---|---|---|---|
| O1 | Convert foreign decision-makers into qualified leads | Lead form + booked calls per month | 30 qualified leads/month by month 6 |
| O2 | Build a vetted talent pool | Talents with status "Vetted" | 150 vetted, 300 applicants |
| O3 | Reduce time to fill | Request date → shortlist sent | ≤ 48 h for shortlist, ≤ 10 days to start |
| O4 | Grow recurring revenue | Active placements × monthly margin | 15 active placements |
| O5 | Retain talents and clients | Talent retention at 6/12 months, client churn | ≥ 85 % at 6 months |
| O6 | Generate referral leads | Referral sign-ups and converted referrals | 10 % of new clients from referrals |

### 1.3 Target markets and languages

Launch market is France and French-speaking Europe (Belgium, Switzerland); second wave is English-speaking Europe/DACH, then the Gulf. The site therefore ships in **English and French** at launch, with **Arabic (RTL)** as a Could for the Gulf and talent side.

### 1.4 Launch niche

The MVP catalog focuses on 2–3 high-demand profiles: Full-Stack JavaScript (React/Node), UI/UX Designers, and one infra profile (DevOps/Cloud). Other categories are listed but marked "on request" until the pool is deep enough.

## 2. Scope and delivery phases

The build is split into three phases so a marketing site and a working back-office ship first (MVP, ~10 weeks), and self-service portals follow once placements exist.

| Module | Phase 1 — MVP | Phase 2 | Phase 3 |
|---|---|---|---|
| Public website (EN/FR) | All pages in section 4, CMS-editable | Blog/SEO expansion, AR version | Programmatic SEO pages per role × country |
| Lead capture | Hire form, Book a call (Calendly/Cal.com), contact | Savings calculator, multi-step request wizard | Instant price estimate |
| Talent pool | "Join our network" application form + CV upload | Talent portal: profile, availability, documents | Skill tests in-platform, badges |
| Public talent showcase | Curated, anonymised talent cards (admin-published) | Search and filters, "request this profile" | Shortlists shared by secure link |
| Client portal | — (shortlists sent by email/PDF) | Requests, shortlists, interviews, active talents, invoices | Timesheets approval, team reports |
| Admin back-office | Leads CRM, talent pipeline (ATS), placements, referrals | Contracts, invoicing, payouts tracking | Analytics dashboards, automation |
| Referral program | Referral form + manual tracking | Personal referral link + dashboard | Automated payouts |
| Billing | Manual invoices (exported PDF) | Invoice generation per placement | Online payment (via foreign entity / Stripe) |

**Out of scope (all phases unless re-decided):** payroll processing itself (handled by accountant/payment provider), time-tracking software built from scratch (integrate instead), video interviewing built in-house (use Google Meet/Zoom links), a public freelance marketplace where clients contract talents without the agency.

## 3. Users, personas and roles

Five roles use the platform; the public site serves the first two personas, the portals serve all five.

### 3.1 Personas

| Persona | Who | Goal on the site | Main fear | What the platform must prove to them |
|---|---|---|---|---|
| Client — Startup founder / CTO | 10–50 person tech company, France/EU | Add 1–3 developers fast without a long hiring cycle | Poor quality, communication gaps, hidden costs | Vetting process, real profiles, price clarity, 2-week trial |
| Client — Engineering / HR manager | Scale-up or digital agency | Extend an existing team for 6–24 months | Talent leaving mid-project, legal/IP risk | Replacement guarantee, contracts, NDA/IP, time-zone overlap |
| Talent — Developer / Designer | Algerian, 2–10 years experience, B2+ English or French | Get stable foreign remote work, paid on time | Not getting paid, unclear contract | Pay transparency, payment method, support, career growth |
| Referrer | Existing client, partner, freelancer, talent | Earn a reward for introducing a client | Not being paid the reward | Clear reward table, status tracking |
| Agency staff | Founder, sales, recruiter, admin/finance | Run the pipeline end to end | Data scattered in spreadsheets | One back-office for leads, talents, placements, billing |

### 3.2 Roles and permissions

| Role | Access | Can do |
|---|---|---|
| Visitor | Public site | Browse, submit forms, book a call, apply as talent |
| Talent | Talent portal | Edit profile, upload CV/documents, set availability, see interviews and placements, see payouts |
| Client user | Client portal (own company only) | Create talent requests, view shortlists, book interviews, accept/reject, view active talents and invoices |
| Client admin | Client portal | All client user rights + invite colleagues, see billing |
| Referrer | Referral dashboard | Get link, see referred leads and reward status |
| Recruiter | Back-office | Manage talents, vetting, shortlists, interviews |
| Sales | Back-office | Manage leads, companies, requests, proposals |
| Finance | Back-office | Contracts, invoices, payouts, referral rewards |
| Super admin | Everything | Users, roles, CMS, settings, audit log |

## 4. Platform map: pages and modules

The platform has four spaces sharing one database: the public site (outside the existing landing page), the client dashboard, the talent dashboard and the agency back-office. The back-office is built first because it runs the business from the first placement.

_[embedded diagram: platform map — 4 spaces, 51 screens]_

URL prefixes: `/` and `/fr/` for public pages, `/app/client`, `/app/talent`, `/admin`. A logged-in user lands in the space of their role; staff can open any client or talent record from the back-office.

## 5. Pricing, money flow and who pays what

Only the client pays. The agency invoices the client a monthly fee per talent, pays the talent a fixed net amount, and keeps a target gross margin of 35–45 % of the client price; talents never pay anything to the platform.

### 5.1 Who pays whom

| Payer | Receiver | What | When | Amount rule |
|---|---|---|---|---|
| Client | Agency | Monthly fee per placed talent (dedicated / team extension) | Invoice on the 1st of the month, in advance, due in 7 days | Client rate from the rate card (5.2) |
| Client | Agency | Time & Material hours/days | Invoice on the 1st, for the previous month, due in 15 days | Approved timesheet × hourly or daily rate |
| Client | Agency | Buy-out fee (client hires the talent directly) | On signature of the buy-out | See 5.5 |
| Client | Agency | Project-based work (secondary offer) | Milestones, e.g. 30 % / 40 % / 30 % | Fixed quote |
| Agency | Talent | Monthly net pay | By the 10th of the following month | Agreed talent rate × days worked |
| Agency | Referrer | Referral reward | After the referred client's 2nd paid invoice | Reward table (5.6) |
| Agency | Payment providers / bank | Transfer and FX fees | Per transaction | Real cost, logged per invoice |
| Talent | Platform | Nothing | — | Never charge talents (no sign-up, placement or commission fee shown to them) |

The client sees only its own price. The talent sees only its own pay. The margin is visible only to Finance and Super admin.

### 5.2 Rate card (proposed defaults, editable in settings)

The client price is computed from the talent's net monthly pay with a markup. Formula: **client price = talent pay ÷ (1 − target margin)**. At a 40 % margin the markup is ×1.67.

| Seniority | Experience | Talent net pay (€/month) | Target margin | Client price (€/month) | Agency margin (€/month) |
|---|---|---|---|---|---|
| Junior | 1–2 years | 700 | 44 % | 1,250 | 550 |
| Mid | 3–5 years | 1,200 | 40 % | 2,000 | 800 |
| Senior | 5–8 years | 2,000 | 37.5 % | 3,200 | 1,200 |
| Lead / Expert | 8+ years | 2,800 | 35 % | 4,300 | 1,500 |

Rules:

- The percentage margin goes down as seniority goes up, so senior talents stay competitive versus local hiring (about 40–50 % cheaper than a €4,000–7,000 French salary cost).
- Rare skills (AI/ML, Cloud architect, cybersecurity) add a +10–20 % skill premium on both sides.
- Hourly T&M rate = client monthly price ÷ 160 h × 1.15 (a 15 % premium for flexibility). Daily rate = hourly × 8.
- Part-time (50 %) = 55 % of the full-time price.
- Minimum engagement: 1 month for dedicated, 40 hours for T&M.

### 5.3 Discounts

| Condition | Discount on client price | Who absorbs it |
|---|---|---|
| Team of 3+ talents | −5 % | Agency margin |
| 6-month commitment | −5 % | Agency margin |
| 12-month commitment (annual plan) | −10 % | Agency margin |

Discounts do not stack beyond −12 %. The talent's pay is never reduced by a client discount. The system must block any deal where the margin falls under the **floor of 25 %** unless Super admin approves it.

### 5.4 Trial period and replacement guarantee

- Every placement starts with a **2-week trial** (10 working days).
- If the client keeps the talent: the trial days are billed normally in the first invoice.
- If the client stops during the trial: the client pays **nothing** for those days. The agency still pays the talent for the days worked; this cost is the price of the guarantee and is logged as "trial loss".
- The client gets **one free replacement** during the trial, and one free replacement in the first 3 months if the talent leaves or underperforms. The new talent starts a new 2-week trial.

### 5.5 Buy-out (client hires the talent directly)

The client contract includes a non-solicitation clause valid during the contract and 12 months after. A client can hire the talent legally by paying a buy-out fee:

| Time since placement start | Buy-out fee |
|---|---|
| 0–6 months | 3 × monthly client price |
| 6–12 months | 2 × monthly client price |
| 12–24 months | 1 × monthly client price |
| 24+ months | Free (Build-Operate-Transfer completed) |

### 5.6 Referral rewards (cost for the agency)

| Referral type | Reward | Cost versus margin earned |
|---|---|---|
| Monthly plan (1+ talent) | €300 | 37.5 % |
| Team (3+ talents) | €500 + €100 per extra talent | ~21 % of the first month's team margin |
| Annual plan (12 months) | €1,000 | ~14 % of the 12-month margin after the annual discount (€7,200) |

The reward becomes payable only when the referred client has paid two invoices and the talent passed the trial. If the client leaves before 3 months, a pending reward is cancelled. Referrers cannot refer their own company.

### 5.7 Worked example: one mid developer for 12 months

| Line | Monthly | 12 months |
|---|---|---|
| Client price (€2,000 −10 % annual plan) | €1,800 | €21,600 |
| Paid to the talent | −€1,200 | −€14,400 |
| Gross margin | €600 (33 %) | €7,200 |
| Payment and FX fees (~2 % of invoice) | −€36 | −€432 |
| Referral reward (annual, if referred) | — | −€1,000 |
| Contribution margin before overheads | — | €5,768 (27 %) |

The dashboard KPIs (section 11) must show both the gross margin and this contribution margin per placement.

### 5.8 Currencies, invoicing entity and taxes

- Client prices are in EUR at launch; USD and GBP can be added as settings (one currency per client contract).
- Talent pay is set in EUR and paid either in EUR (foreign-currency account or Payoneer) or converted to DZD. The rate used and the fee are stored on each payout.
- Invoicing entity options from the study: Algerian SARL/EURL exporting digital services (SWIFT to a foreign-currency account), Payoneer receiving accounts, or a foreign entity (France, Estonia, USA) to accept cards and SEPA. The platform must support **several legal entities**, each with its own invoice numbering, bank details and tax mentions.
- VAT and Algerian tax treatment of service exports must be confirmed by the accountant before go-live; invoices for EU B2B clients normally carry no VAT with a reverse-charge mention, to be validated.

## 6. Core processes and status lifecycles

Five processes run the business: talent vetting, client request, placement, monthly billing and referral. Each object has a fixed list of statuses; the back-office only allows the transitions listed below and logs who changed what and when.

### 6.1 Talent vetting process

Goal: turn an applicant into a "Vetted" talent that sales can propose. Target duration: 7–10 days.

| Step | Status after the step | Done by | What happens | Exit if it fails |
|---|---|---|---|---|
| 1. Application | Applied | Talent | Fills "Join our network" form: CV, LinkedIn/GitHub/portfolio, role, skills, years, English/French level, expected pay, availability | — |
| 2. CV screening | Screening | Recruiter | Checks minimum criteria (experience, stack in demand, language). Auto-reject rules can pre-filter | Rejected (email with reason category, re-apply after 6 months) |
| 3. HR call (20–30 min) | HR interview | Recruiter | Motivation, communication in English/French, remote experience, pay expectations, notice period | Rejected |
| 4. Technical test | Technical test | Talent | Take-home or live test per track (code test for devs, portfolio + case for designers). Link sent from the platform, deadline 5 days | Rejected / Expired |
| 5. Technical interview | Tech interview | Senior reviewer (internal or external) | 45–60 min deep dive; reviewer fills a scorecard (score /100 per skill) | Rejected |
| 6. Reference check | References | Recruiter | 1–2 references for mid+ profiles | On hold |
| 7. Approval | Vetted · Available | Recruiter lead | Sets seniority, talent pay, public showcase yes/no, generates the anonymised profile | — |

After vetting, the talent's status moves with placements: **Available → Proposed → In trial → Placed → Available again** (or Inactive if they stop answering for 60 days, or Blacklisted after a serious breach). A talent can be proposed to several clients at once but can only have one full-time placement.

### 6.2 Client request (sales pipeline)

| Status | Meaning | Who moves it | Target delay |
|---|---|---|---|
| New lead | Form, booked call, referral or manual entry | System | — |
| Contacted | Sales replied or the call happened | Sales | < 24 business hours |
| Qualified | Need, budget, start date and decision-maker confirmed; a Talent Request is created | Sales | — |
| Sourcing | Recruiters match talents from the pool or search outside | Recruiter | — |
| Shortlist sent | 2–4 profiles sent to the client portal | Recruiter | ≤ 48 h after Qualified |
| Interviewing | Client books interviews with selected talents | Client | — |
| Proposal sent | Price, model, start date and contract sent for e-signature | Sales | ≤ 2 h after a selection |
| Won | Contract signed → a Placement is created per talent | System | — |
| Lost | Reason required: price, timing, no fit, competitor, no answer | Sales | — |

One client company can have several requests; one request can produce several placements (team).

### 6.3 Placement lifecycle

A placement links one talent, one client and one contract with its prices (client price, talent pay, margin).

| Status | Meaning | Allowed next statuses |
|---|---|---|
| Draft | Created from a won request, contract not yet signed by both parties | Pending start, Cancelled |
| Pending start | Contracts signed (client + talent), onboarding checklist running | In trial |
| In trial | First 10 working days | Active, Ended in trial (→ replacement) |
| Active | Normal monthly billing | Notice, Bought out |
| Notice | Client or talent gave notice (default 30 days for client, 30 days for talent) | Ended, Replaced |
| Replaced | Talent replaced; a new placement is created and linked | — (closed) |
| Bought out | Client paid the buy-out fee and hired directly | — (closed) |
| Ended | Contract finished | — (closed) |
| Cancelled | Never started | — (closed) |

Onboarding checklist (Pending start): client contract signed, talent contract and NDA/IP assignment signed, client tools access given (email, Slack/Teams, Jira, Git), kick-off call held, first check-in date set.

During Active: monthly check-in with the talent (satisfaction 1–5), quarterly check-in with the client (NPS 0–10). A score of ≤ 2 or NPS ≤ 6 opens a "risk" flag for the account manager.

### 6.4 Monthly billing cycle

1. **Day 25–last day:** talents on T&M submit their timesheet; clients approve it in their portal (auto-approved after 3 days without answer).
2. **Day 1:** the system generates draft invoices: dedicated placements for the coming month (in advance) plus T&M for the previous month, plus adjustments (absences, credits, prorated days).
3. **Day 1–2:** Finance reviews and issues invoices; the client receives an email and sees the invoice in the portal.
4. **Day 7 / 15:** due dates. Reminders at due date, +3 days and +10 days. After +15 days the account is flagged "overdue" and sales is alerted; after +30 days Finance can suspend new requests.
5. **By day 10:** talent payouts for the previous month are generated (days worked × daily pay), approved by Finance and marked paid with the transfer reference.

Absences: paid leave days per talent contract (e.g. 2 days/month accrued, configurable) are not billed to the client on dedicated contracts unless the contract says otherwise; national holidays follow the client's or the talent's calendar as set in the contract.

### 6.5 Referral process

1. Referrer gets a personal link or code (from the referral page or their dashboard).
2. A lead arriving with that code is tagged with the referrer (first-touch, valid 90 days).
3. When the lead becomes Won, a reward is created with status **Pending**.
4. When the client has paid 2 invoices and the trial is passed → **Payable**.
5. Finance pays (bank or Payoneer) → **Paid**. If the client leaves before 3 months → **Cancelled**.

## 7. User journeys

Each journey below lists the steps, the page or dashboard screen used, and what the system does in the background. Screens are detailed in sections 8–11.

### 7.1 Client — from first visit to active talent

| # | Client action | Screen | System / agency action |
|---|---|---|---|
| 1 | Lands on the site, browses talent profiles | Talents directory, Talent profile | Tracks source (UTM, referral code) |
| 2 | Clicks "Hire talent" or "Request this profile" | Hire request form (multi-step) | Creates Lead + Company + Talent Request; confirmation email; Slack alert to sales |
| 3 | Books a 30-min discovery call (optional) | Calendar step at the end of the form | Call added to sales calendar with lead details |
| 4 | Receives an email "Your shortlist is ready" and creates an account (magic link, no password needed first time) | Client dashboard → Shortlist | Recruiter has published 2–4 anonymised profiles with scorecards and prices |
| 5 | Compares profiles, marks "Interview" or "Not a fit" (reason) | Shortlist | Notifies recruiter and talent |
| 6 | Picks an interview slot | Interview scheduling | Creates a Meet/Zoom link; reminders 24 h and 1 h before |
| 7 | After the interview, clicks "Hire" | Interview result | Sales prepares the proposal |
| 8 | Reviews and signs the proposal/contract online | Contracts | E-signature; placement created in Pending start |
| 9 | Completes onboarding checklist (tools access, kick-off date) | Placement detail | Talent gets onboarding info |
| 10 | Works with the talent; trial ends after 10 days — clicks "Keep" or "Replace" | Placement detail | Keep → Active; Replace → new shortlist within 48 h |
| 11 | Each month: approves timesheets (T&M), receives invoice, pays | Timesheets, Invoices | Reminders if overdue |
| 12 | Adds more talents, gives notice, or buys out | Team, Requests | New request / Notice / Buy-out flow |

### 7.2 Talent — from application to payout

| # | Talent action | Screen | System / agency action |
|---|---|---|---|
| 1 | Applies via "Join our network" | Talent application form | Creates account + profile in Applied; email with next steps |
| 2 | Verifies email, completes profile (skills, experience, portfolio, pay expectation, availability) | Talent dashboard → Profile | Profile completeness % shown; incomplete profiles are not screened |
| 3 | Gets invited to the HR call and the technical test | Dashboard → Vetting progress | Status updates and emails at each step |
| 4 | Becomes Vetted | Vetting progress | Pay rate and seniority fixed; can opt in/out of public showcase |
| 5 | Is proposed to a client, accepts or declines the opportunity | Opportunities | Talent sees client industry, mission, duration and their own pay — never the client price |
| 6 | Attends the client interview | Interviews | Calendar link, preparation notes |
| 7 | Signs the talent contract (freelance agreement or employment), NDA and IP assignment | Contracts | E-signature |
| 8 | Starts the mission, logs time (T&M) or confirms days worked | My mission, Timesheets | Monthly check-in survey |
| 9 | Sees payout statements and payment status | Payouts | Payout created by the 10th of each month |
| 10 | At the end of the mission, sets status back to Available | Profile | Re-enters the matching pool |

### 7.3 Referrer

1. Opens the Referral page, enters name, email and payment preference → gets a link and code (no full account needed; a light dashboard by magic link).
2. Shares the link or submits a company introduction form (company, contact, need).
3. Follows status per referral: Submitted → Contacted → Won → Reward pending → Payable → Paid.
4. Receives the reward and a payment receipt.

Clients and talents can also refer from their own dashboard with the same link.

### 7.4 Agency team — daily operations

- **Sales:** works the lead inbox each morning, qualifies leads, creates talent requests, sends proposals, follows the pipeline board.
- **Recruiter:** processes new applications, runs vetting steps, answers talent requests by building shortlists from the matching tool, schedules interviews.
- **Account manager (can be sales at the start):** runs onboarding, check-ins, risk flags, renewals, replacements.
- **Finance:** reviews draft invoices on the 1st, follows payments, approves talent payouts by the 10th, pays referral rewards.
- **Super admin:** manages users, settings (rates, margins, discounts, templates), content of public pages, and reads the KPI dashboard.

## 8. Public pages (excluding the landing page)

Twelve public pages besides the landing page; each entry gives its purpose, content and functions.

### 8.1 Hire request (`/hire`) — M

The main conversion page for clients: a 4-step form, progress shown, data kept if the visitor goes back.

1. **Need:** engagement model (single talent, team extension, dedicated team, T&M, project), category and role, number of talents.
2. **Profile:** seniority, required skills (tags with autocomplete), nice-to-have skills, languages (EN/FR/AR), time-zone overlap required (hours).
3. **Timing and budget:** start date (ASAP / 2 weeks / 1 month / later), duration (1–3 / 3–6 / 6–12 / 12+ months), full or part time, budget range (optional).
4. **Contact:** name, work email, company, country, website, phone (optional), how did you hear about us, referral code (pre-filled from link), consent checkbox.

After submit: thank-you screen with an embedded calendar to book the discovery call, and an **indicative price range** computed from the rate card (5.2) for the chosen seniority (S). If the request came from a talent profile, the talent ID is attached.

### 8.2 Talents directory (`/talents`) — S (M: static list of curated profiles)

- Lists anonymised Vetted talents who opted into the showcase.
- Filters: category, role, seniority, skills, languages, availability (now / within 30 days), engagement (full/part time).
- Sort: best match, availability, experience.
- Card: first name + last initial, role, seniority, years, top 4 skills, languages, availability date, vetting score, optional "from €X/month" (setting on/off).
- Never shown: full name, photo without consent, contact details, current employer, exact city, social links.

### 8.3 Talent public profile (`/talents/<id>`) — S

Summary, skills with levels, experience timeline (company names can be hidden as "Fintech scale-up, France"), education, portfolio thumbnails (designers), vetting scorecard summary, languages, availability. Actions: "Request this profile" (→ 8.1 pre-filled), "Book an interview" (→ requires request form), "See similar talents".

### 8.4 Category pages (`/hire/<role>`) — S

One page per role (React developers, UI/UX designers, DevOps…): what the role does, skills vetted, test used, typical price range, available profiles of that role, FAQ, request form. Used for SEO in EN and FR.

### 8.5 For Talents (`/talents/join`) + application — M

Explains to talents: types of missions, how vetting works (steps of 6.1), how and when they are paid, contract types, benefits (training, community, referral bonus), FAQ. Application form fields: name, email, phone/WhatsApp, city, role, years, main skills, English and French level (A1–C2), CV upload (PDF, ≤ 5 MB), LinkedIn, GitHub, portfolio, expected net monthly pay (EUR), availability date, notice period, full/part time, consent.

### 8.6 Pricing (`/pricing`) — M

Explains how pricing works without publishing the margin: price depends on role, seniority, skill rarity, duration and number of talents. Shows starting prices per seniority, the discounts (5.3), what is included (vetting, trial, replacement, account manager, invoicing) and what is not (hardware, client software licenses). Includes the comparison "In-house hiring vs Freelance vs Outsourcing vs Staff augmentation" on cost, speed, flexibility and replacement, and a **savings calculator**: role + seniority + country → local hiring cost vs our monthly price → yearly savings (country salary data stored in settings, with sources).

### 8.7 How it works (`/how-it-works`) — M

Detailed client process (request → shortlist in 48 h → interviews → trial → ongoing support), the vetting funnel with pass rates, contract and IP explanations, guarantees, FAQ.

### 8.8 Referral program (`/referral`) — M

Reward table (5.6), conditions, steps, form to get a link, form to introduce a company directly, terms of the program.

### 8.9 Case studies (`/case-studies`, `/case-studies/<slug>`) — S

List with filters (industry, role). Each case: client (or anonymised), need, profiles provided, time to fill, duration, results, client quote.

### 8.10 Blog / Resources (`/blog`) — S

Articles in EN/FR with categories, tags, author, reading time, related posts, CTA block to hire request. SEO fields per article.

### 8.11 About / Why Algeria / Contact — M

About: team, mission, legal entity, offices. Why Algeria: talent pool, time zone, languages, cost, with sourced figures. Contact: form, email, phone/WhatsApp, address, hours (CET).

### 8.12 Authentication and legal — M

- Log in with role choice (Company / Talent / Agency), magic link or email + password, Google sign-in (S), password reset, email verification, optional 2FA (mandatory for agency staff).
- Legal pages: Privacy policy (GDPR + Algerian law 18-07 on personal data), Terms of use, Talent terms, Client terms summary, Referral terms, Cookie policy, Legal notice.
- Error pages: 404, 500, maintenance.

## 9. Talent dashboard

The talent dashboard lets a developer or designer manage their profile, follow vetting, accept opportunities, log time and see payouts. MVP keeps only Profile and Vetting progress; the rest is Phase 2.

### 9.1 Navigation

Home · My profile · Vetting · Opportunities · Interviews · My mission · Timesheets · Payouts · Documents · Refer & earn · Settings

### 9.2 Screens and functions

| Screen | Content | Actions | Priority |
|---|---|---|---|
| Home | Current status (e.g. "Technical test due in 3 days" or "Placed at Fintech client — day 34"), profile completeness %, next actions to do, latest notifications, next payout date and amount | Go to next action | S (M: status only) |
| My profile | Personal info, headline, role, seniority (read-only, set by agency), skills with years and level, experience, education, certifications, portfolio links/files, languages with level, expected pay, availability date, full/part time, showcase opt-in, preview of the anonymised public profile | Edit, upload CV (parse to pre-fill, C), set availability, toggle showcase | M |
| Vetting | Stepper of the 7 steps in 6.1 with status, dates, test link and deadline, interview slot, final result | Book HR call slot, start test, upload test result link | M |
| Opportunities | Missions proposed by the recruiter: client industry and size (name hidden until interview), project, stack, duration, start date, full/part time, **talent's own monthly pay** | Accept to be presented / Decline with reason | S |
| Interviews | Upcoming and past interviews, meeting link, prep notes, client feedback after decision | Join, reschedule request | S |
| My mission | Active placement: client name, manager contact, start date, trial end date, contract type, notice period, onboarding checklist, monthly check-in survey | Fill check-in, request leave, give notice | S |
| Timesheets (T&M) | Monthly calendar, hours per day, project/task note, status (Draft, Submitted, Approved, Rejected) | Fill, submit, correct if rejected | S |
| Payouts | Monthly statements: days worked, daily pay, deductions/adjustments, amount, currency, FX rate, method, status (Pending, Approved, Paid), transfer reference, downloadable statement PDF | Download, update payout details | S |
| Documents | Contract, NDA, IP assignment, ID, tax/auto-entrepreneur card, bank or Payoneer proof; expiry dates | Upload, sign (e-signature), download | S |
| Refer & earn | Personal referral link for clients and for talents (talent referral bonus, e.g. €100 after the referred talent passes 3 months of placement — setting) | Copy link, see referral statuses | S |
| Settings | Email, password, 2FA, language (EN/FR/AR), notification preferences, delete account (GDPR) | Edit | M |

### 9.3 What the talent can never see

The client price, the agency margin, other talents' pay, client contacts before the interview stage, and internal recruiter notes and scorecards (the talent sees only a summary of feedback).

## 10. Client dashboard

The client dashboard is where a company reviews shortlists, interviews and hires talents, follows its team, approves timesheets and pays invoices. It is Phase 2; in the MVP, shortlists and invoices are sent by email as PDF from the back-office.

### 10.1 Navigation

Overview · Requests · Shortlists · Interviews · My team · Timesheets · Invoices · Contracts · Refer & earn · Company settings

### 10.2 Screens and functions

| Screen | Content | Actions |
|---|---|---|
| Overview | Active talents count, open requests and their status, next interviews, current month cost, unpaid invoices, account manager card (name, photo, email, WhatsApp, calendar link) | Quick "New request", contact account manager |
| Requests | List of talent requests with status (6.2), role, seniority, number of talents, created date, time since creation | New request (same steps as 8.1), edit, cancel, duplicate |
| Shortlists | Per request: 2–4 profile cards with full anonymised profile, vetting scorecard, recruiter's note "why this match", monthly price, availability | Mark Interview / Not a fit (reason) / Hire directly, compare side by side, comment to recruiter |
| Interviews | Calendar of interviews, slots proposed by talents, meeting links, feedback form after each interview (rating 1–5, strengths, concerns, decision) | Book, reschedule, cancel, submit feedback |
| My team | Active placements: talent, role, start date, model, trial end, monthly price, status, last check-in score | Open placement, keep or replace at trial end, request replacement, give notice, request buy-out quote, add a talent |
| Placement detail | Contract summary, onboarding checklist, timeline of events (start, trial, check-ins, notices), documents, absences | Complete checklist, rate quarterly (NPS), declare absence |
| Timesheets (T&M only) | Monthly timesheets per talent with hours and notes | Approve, reject with comment (auto-approval after 3 days) |
| Invoices | Invoice list: number, period, amount, due date, status (Issued, Paid, Overdue), PDF | Download, see payment instructions (IBAN/SWIFT, Payoneer), pay online (C, if a foreign entity with Stripe/SEPA exists) |
| Contracts | Master service agreement, order forms per placement, NDA, signed dates | Sign, download |
| Refer & earn | Referral link, referred companies, rewards | Copy link |
| Company settings | Company info, billing entity and address, VAT number, billing email, users and roles (Client admin / Client user), notification preferences | Invite colleague, change role, remove user |

### 10.3 Visibility rules

A client sees only its own company's data. Talent full name and contact details are shown only after the client books an interview; personal email and phone stay hidden for the whole relationship (communication goes through the client's own tools after onboarding). Client users who are not Client admin do not see invoices unless granted.

## 11. Admin back-office

The back-office is the MVP's core: one tool replacing spreadsheets for leads, talents, requests, placements, billing, payouts, referrals and content. Every list has search, filters, saved views, CSV export and bulk actions; every record has an activity timeline (emails, notes, status changes, files).

### 11.1 Navigation

Dashboard · Leads & companies · Talent requests · Talents (ATS) · Matching · Interviews · Placements · Contracts · Invoices · Payouts · Referrals · Reports · Content (CMS) · Settings · Users & roles · Audit log

### 11.2 Modules

| Module | Main functions | Priority |
|---|---|---|
| **Dashboard (KPIs)** | Active placements, MRR (monthly recurring revenue), gross margin € and %, contribution margin, new leads this month, lead → won conversion, time to shortlist and time to fill (median), talents per vetting stage, talent retention at 6/12 months, client churn, overdue invoices, payouts due, risk flags. Period filter and comparison with previous period | M (basic counters), S (charts) |
| **Leads & companies** | Kanban and list of the pipeline (6.2), company profile (size, country, industry, website), contacts, source and UTM, referral link, notes, tasks with due dates, lost reasons | M |
| **Talent requests** | Request detail (all fields of 8.1), assigned recruiter, deadline countdown (48 h), linked shortlist, status | M |
| **Talents (ATS)** | Kanban of vetting stages (6.1), full profile (including real name, contacts, CV, current pay, expected pay), scorecards from each reviewer, tags, notes, documents, availability, placement history, blacklist flag, duplicate detection (email/phone) | M |
| **Matching** | For a request: search the pool by skills, seniority, language, availability, pay range; ranked results with a match score (skills overlap 50 %, seniority 20 %, availability 15 %, language 10 %, vetting score 5 % — weights in settings); add to shortlist; generate the anonymised profile; publish shortlist to client portal or export PDF | M (manual search + PDF), S (scoring + portal) |
| **Interviews** | All client interviews, slots, links, feedback from both sides | S |
| **Placements** | Lifecycle (6.3), prices: client price, talent pay, discount, margin (computed, colour warning under 30 %, block under 25 %), trial end, renewal date, notice, onboarding checklist, check-in scores, replacement link, buy-out | M |
| **Contracts** | Templates (client MSA, order form, talent freelance agreement, NDA, IP assignment) with merge fields, generation, e-signature status, versioning | S (M: upload signed PDFs) |
| **Invoices** | Monthly draft generation (6.4), edit lines, credit notes, multi-entity numbering, PDF in EN/FR, send by email, record payment (date, amount, method, fees), reminders, aging report | M (manual create + PDF), S (auto-generation) |
| **Payouts** | Monthly payout generation per talent, adjustments (bonus, deduction, leave), approval, mark paid with reference and FX rate, statement PDF | S (M: manual record) |
| **Referrals** | Referrers, links/codes, attributed leads, rewards with status (6.5), payment record | M (manual), S (links) |
| **Reports** | Revenue and margin by client, by talent, by role, by month; pipeline report; recruiter performance; source performance (cost per lead, CAC vs LTV); exports | S |
| **Content (CMS)** | Edit public pages, talent showcase selection, case studies, blog, FAQ, testimonials, client logos, stats, translations EN/FR/AR | M |
| **Settings** | Rate card, margins, floor margin, discounts, buy-out table, referral rewards, trial length, replacement rules, notice periods, matching weights, legal entities, currencies, email templates, tax mentions, working calendar and holidays | M |
| **Users & roles** | Invite staff, assign role (Recruiter, Sales, Finance, Super admin), 2FA enforced, deactivate | M |
| **Audit log** | Every create/update/delete on talents, prices, placements, invoices, payouts and settings with user, time, old and new values | M |

### 11.3 Permissions matrix (back-office)

| Data | Recruiter | Sales | Finance | Super admin |
|---|---|---|---|---|
| Talents and vetting | Edit | View | View | Edit |
| Talent pay | View | View | Edit | Edit |
| Leads, companies, requests | View | Edit | View | Edit |
| Client price and discounts | — | Edit (within floor) | Edit | Edit |
| Margin | — | View | View | View |
| Invoices and payouts | — | View | Edit | Edit |
| Settings, users, audit log | — | — | Settings: pricing only | Edit |

## 12. Business rules

These rules must be enforced by the system, not left to staff memory.

| ID | Rule |
|---|---|
| FR-PRICE-01 | Client price is computed as talent pay ÷ (1 − margin) from the rate card; manual override allowed, margin recalculated live. |
| FR-PRICE-02 | A placement cannot be saved with a margin under the floor (25 %) without Super admin approval, logged in the audit log. |
| FR-PRICE-03 | Changing a rate card setting never changes signed placements; only new proposals use the new values. |
| FR-PRICE-04 | Discounts are capped at −12 % combined and never reduce talent pay. |
| FR-TAL-01 | Only talents in status Vetted/Available can be added to a shortlist. |
| FR-TAL-02 | A talent can hold one full-time placement at a time; part-time total must not exceed 100 %. |
| FR-TAL-03 | A rejected applicant can re-apply after 6 months (configurable); duplicates by email or phone are merged. |
| FR-TAL-04 | A talent is shown publicly only if Vetted, showcase opt-in is on, and consent date is stored. |
| FR-REQ-01 | A qualified request must get a shortlist within 48 business hours; the system alerts the recruiter at 24 h and the lead at 40 h. |
| FR-REQ-02 | A lost request requires a lost reason. |
| FR-PLC-01 | A placement starts In trial for 10 working days; at day 8 the client is asked to Keep or Replace; no answer by day 10 = Keep. |
| FR-PLC-02 | Ended in trial → trial days not billed, talent still paid, cost logged as trial loss, replacement request opened automatically. |
| FR-PLC-03 | One free replacement within the first 3 months; further replacements need sales approval. |
| FR-PLC-04 | Buy-out fee is computed from the buy-out table (5.5) based on placement start date. |
| FR-BILL-01 | Dedicated placements are billed in advance on the 1st; T&M in arrears from approved timesheets; partial months are prorated by working days. |
| FR-BILL-02 | Invoice numbers are sequential per legal entity and per year, never reused; issued invoices cannot be edited, only corrected by a credit note. |
| FR-BILL-03 | Overdue +15 days → account flag; +30 days → new requests blocked until Finance unblocks. |
| FR-PAY-01 | Talent payouts are created by the 10th for the previous month, whatever the client payment status (agency carries the cash risk). |
| FR-PAY-02 | Each payout stores currency, FX rate, method and fees. |
| FR-REF-01 | Referral attribution is first-touch, valid 90 days; self-referral is blocked; reward payable after 2 paid invoices and trial passed; cancelled if client leaves before 3 months. |
| FR-SEC-01 | Talent contact details are never exposed to clients before an interview is booked, and personal phone/email are never exposed. |
| FR-SEC-02 | Client price and margin are never exposed to talents; talent pay and margin are never exposed to clients. |

## 13. Notifications and emails

All messages are templates editable in settings, in EN and FR (AR for talents, C); each is sent by email and shown in the in-app notification centre; staff alerts also go to Slack (S).

| Trigger | Recipient | Message |
|---|---|---|
| Hire request submitted | Client | Confirmation, next steps, calendar link |
| Hire request submitted | Sales (email + Slack) | New lead with details and source |
| Shortlist published | Client | "Your shortlist is ready" + link |
| 24 h / 40 h without shortlist | Recruiter / Recruiter lead | SLA warning |
| Interview booked / 24 h before / 1 h before | Client + talent + recruiter | Invitation and reminders with link |
| Proposal or contract to sign | Client / talent | E-signature request, reminder after 2 days |
| Placement starts | Client + talent | Onboarding checklist, account manager contact |
| Trial day 8 | Client | "Keep or replace?" |
| Monthly check-in due | Talent | Survey link |
| Low check-in or NPS score | Account manager | Risk flag |
| Timesheet to submit (day 25) / to approve | Talent / client | Reminder |
| Invoice issued / due / overdue +3 / +10 | Client billing contact | Invoice and reminders |
| Payout paid | Talent | Statement and reference |
| Application received / stage changed / rejected / vetted | Talent | Status update |
| Opportunity proposed | Talent | Mission summary, accept or decline |
| Referral status changed / reward paid | Referrer | Status update |
| Notice given | Account manager, finance | Alert with end date |

## 14. Data model

The core entities and their key fields; every table also has id, created_at, updated_at, created_by.

| Entity | Key fields | Relations |
|---|---|---|
| User | email, password hash, role, language, 2FA, last login, status | 1–1 Talent or 1–n CompanyUser or Staff |
| Company | name, country, industry, size, website, VAT number, billing address, billing email, legal entity used, currency, status (lead/client/churned), source, referral_id | has Contacts, Requests, Placements, Invoices |
| Contact | name, email, phone, job title, is_decision_maker | belongs to Company, may be a User |
| Lead | source, UTM, referral code, stage (6.2), owner, lost reason, notes | belongs to Company; creates TalentRequest |
| TalentRequest | model, role, category, seniority, skills (required/optional), languages, count, start date, duration, time share, budget, status, recruiter, SLA deadline | belongs to Company; has Shortlist |
| Talent | full name, email, phone, city, role, category, seniority, years, skills (skill, level, years), languages (lang, CEFR level), expected pay, agreed pay, availability date, time share, status (6.1), vetting score, showcase opt-in + consent date, public slug, blacklist flag | has Applications steps, Scorecards, Documents, Placements, Payouts |
| VettingStep | type, status, date, reviewer, score, notes, test link | belongs to Talent |
| Scorecard | reviewer, criteria scores, total /100, recommendation | belongs to VettingStep |
| Shortlist / ShortlistItem | request, talent, match score, recruiter note, proposed price, client decision + reason | belongs to TalentRequest |
| Interview | request, talent, client contacts, slot, meeting link, status, feedback client, feedback talent | — |
| Placement | company, talent, request, model, start date, trial end, end date, status (6.3), client price, talent pay, currency, discount, margin €/% (computed), notice dates, replaced_by, buy-out fee | has Contract, Timesheets, InvoiceLines, PayoutLines, CheckIns |
| Contract | type, template version, parties, file, signature status, signed dates | belongs to Placement or Company or Talent |
| Timesheet / TimesheetEntry | period, status, approved by/at; date, hours, note | belongs to Placement |
| CheckIn | type (talent monthly / client quarterly), score, comment | belongs to Placement |
| Invoice / InvoiceLine | legal entity, number, period, issue and due dates, currency, total, status, payments, PDF; line: placement, days/hours, unit price, amount | belongs to Company |
| Payment | invoice, date, amount, method, fees, reference | belongs to Invoice |
| Payout / PayoutLine | talent, period, amount, currency, FX rate, method, fees, status, reference; line: placement, days, rate, adjustments | belongs to Talent |
| Referrer / Referral / Reward | referrer (user or external), code; referral: company, lead, status; reward: type, amount, status, paid date | — |
| LegalEntity | name, country, registration number, bank details, invoice prefix, tax mentions | used by Invoices |
| Setting | key, value, updated by | rate card, margins, discounts, rules |
| AuditLog | user, entity, entity id, action, old value, new value, timestamp, IP | all entities |
| Notification | user, type, payload, channel, read at | — |
| CMS content | pages, sections, blog posts, case studies, testimonials, FAQ, translations | — |

## 15. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | Performance | Public pages: Lighthouse ≥ 90, LCP < 2.5 s on 4G. Dashboards: lists of 1,000 rows load in < 1 s (paginated). |
| NFR-02 | Availability | 99.5 % monthly uptime; daily database backups kept 30 days; restore tested every quarter. |
| NFR-03 | Security | HTTPS everywhere, passwords hashed (Argon2/bcrypt), 2FA mandatory for staff, role-based access checked on the server, rate limiting on forms and login, CAPTCHA on public forms, files scanned and stored privately with signed URLs, OWASP Top 10 tested before launch. |
| NFR-04 | Privacy | GDPR (EU clients and visitors) and Algerian law 18-07: consent stored with date, data export and deletion on request within 30 days, retention: rejected applicants 24 months then anonymised, cookie consent before analytics. |
| NFR-05 | Languages | EN and FR at launch for all public pages, dashboards and emails; architecture ready for AR (RTL). Currency and date formats follow the user's locale. |
| NFR-06 | Accessibility | WCAG 2.1 AA for public pages and portals. |
| NFR-07 | SEO | Server-side rendering, clean URLs per language (`/fr/...`), hreflang, sitemap.xml, schema.org (Organization, JobPosting not used, FAQPage, Article), editable meta titles and descriptions. |
| NFR-08 | Responsiveness | All public pages and client/talent dashboards usable on mobile; back-office optimised for desktop, readable on tablet. |
| NFR-09 | Traceability | Audit log on all money and status changes, kept 5 years. |
| NFR-10 | Analytics | Privacy-friendly analytics (Plausible/Matomo or GA4 with consent), conversion events: form start, form submit, call booked, application submitted. |

## 16. Technical architecture and integrations

Recommended: one Next.js application (public site + three dashboards) on a Node.js API with PostgreSQL, so the existing Vercel-hosted landing page is reused. The stack is a recommendation; the team can propose an equivalent.

| Layer | Recommendation | Notes |
|---|---|---|
| Front-end | Next.js (App Router), TypeScript, i18n routing EN/FR/AR | Reuses the current Coders Hub code base |
| Back-end / API | NestJS or Next.js route handlers, REST or tRPC | Business rules of section 12 live here |
| Database | PostgreSQL (Supabase or Neon) + Prisma ORM | Row-level permissions per company |
| Auth | Auth.js / Supabase Auth / Clerk: magic link, email + password, Google, 2FA | Three user spaces: client, talent, staff |
| File storage | S3-compatible private bucket | CVs, contracts, IDs, invoices |
| CMS | Payload CMS, Sanity or Strapi | Public content and translations |
| Hosting | Vercel (front) + managed DB in an EU region | EU hosting simplifies GDPR |
| Background jobs | Cron/queue (e.g. Inngest, BullMQ) | Monthly invoices, payouts, reminders, SLA alerts |

| Integration | Use | Phase |
|---|---|---|
| Calendly or Cal.com | Discovery calls and interview booking | M |
| Google Meet / Zoom | Interview links | S |
| Email service (Resend, Postmark, Brevo) | Transactional emails | M |
| Slack webhook | Staff alerts | S |
| E-signature (Yousign for FR, Docusign, Dropbox Sign) | Contracts | S |
| Technical tests (CodinGame, TestGorilla, HackerRank) or internal | Vetting | S |
| PDF generation | Invoices, payout statements, anonymised profiles | M |
| Payoneer / bank (manual reconciliation) | Payments in and out | M (manual) |
| Stripe / SEPA via a foreign entity | Online card and SEPA payment | C |
| Analytics | Plausible / GA4 | M |
| LinkedIn Insight tag | Ads retargeting | C |

## 17. Roadmap, deliverables and acceptance

Three phases over about 7 months; each phase ends with a demo and acceptance by the founders.

| Phase | Duration | Delivered | Gate to go to next phase |
|---|---|---|---|
| 0 — Design | 3 weeks | Wireframes then UI for public pages (section 8), back-office (11), talent dashboard MVP screens (Profile, Vetting) | Screens approved |
| 1 — MVP | 10 weeks | Public pages EN/FR, hire form, talent application, auth, back-office: leads, requests, ATS, manual matching + PDF shortlist, placements with margin, manual invoices + PDF, referrals (manual), settings, CMS, audit log | First real placement managed fully in the tool |
| 2 — Portals | 8 weeks | Client dashboard, full talent dashboard, interviews, e-signature, timesheets, auto invoices and payouts, matching score, talents directory, notifications + Slack, reports | 5 active placements, invoices generated automatically for 1 month without errors |
| 3 — Growth | ongoing | Arabic, online payments (foreign entity), CV parsing, in-app tests, programmatic SEO pages, automated referral payouts, advanced analytics | — |

### 17.1 Deliverables expected from the development team

- Source code in the company's Git repository, with README and environment setup.
- Staging and production environments; CI/CD with automated tests on business rules (pricing, billing, permissions).
- API documentation and database schema.
- Admin user guide (short videos or written) for each back-office module.
- Seed data and import scripts for existing talents and leads (from spreadsheets).

### 17.2 Acceptance criteria (MVP examples)

- A visitor submits the hire form in EN and FR; a lead, company and request are created and sales gets an alert within 1 minute.
- An applicant applies with a CV; a recruiter moves them through all vetting stages to Vetted, with a scorecard.
- A recruiter builds a shortlist and exports an anonymised PDF with no real name or contact details.
- Creating a placement with talent pay €1,200 at 40 % gives a client price of €2,000 and a margin of €800; a 20 % margin is blocked without Super admin approval.
- A placement ended during the trial produces no client billing for those days and a trial-loss entry.
- Invoices are numbered sequentially per legal entity and cannot be edited once issued.
- A Sales user cannot see talent pay edit fields; a Recruiter cannot see client prices.
- Every price change appears in the audit log with old and new values.
- A talent can request deletion of their data and it is anonymised within 30 days.

### 17.3 Open questions for the founders

- Final brand name and legal entity (Algerian SARL, auto-entrepreneur, or foreign entity) — drives invoicing and payments.
- Talents as freelancers or employees of the agency?
- Show indicative prices publicly on talent cards, or only after the call?
- Who does technical interviews at launch: internal senior or external reviewers (cost per interview)?
- Confirm the default numbers: margins, discounts, trial length, buy-out table, referral rewards.
