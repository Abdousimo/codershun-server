# PROMPTS.md — Copy-paste prompts for the AI agent

Start a **new conversation** for each prompt below (fresh context = better results).
Always review the plan the agent gives you before saying "approved, implement it".

---

## Prompt 1 — Repo audit (no code changes)

```
Read AGENTS.md, PLAN.md and docs/cdc.md (sections 3, 6, 12, 14, 16), then explore this repo:
package.json, src/, prisma/, the SQL schema file at the root, .env.example.

Do NOT change any code. Give me a report with:
1. What exists today: modules, auth implementation, Prisma setup, scripts, tests, config.
2. Whether prisma/schema.prisma matches the SQL schema (tables, enums, computed columns).
3. Problems or risks you see (security, structure, missing pieces), ordered by severity.
4. What is missing compared with Phase 0 of PLAN.md.

Then update ONLY section 2 "Current state" of AGENTS.md with the real paths and findings,
and show me the diff.
```

## Prompt 2 — Prisma alignment & foundations (PLAN 0.2)

```
Read AGENTS.md and PLAN.md item 0.2. Give me a plan first, no code yet.

Goal: make the project foundations solid on top of the existing SQL schema.
- Run `npx prisma db pull` so schema.prisma matches the database. Report any field Prisma
  marks as Unsupported and any computed column (AGENTS.md rule 4) and how we prevent writing it.
- PrismaService + a `withUserContext(user, fn)` helper that opens an interactive transaction
  and runs SET LOCAL app.user_id / app.role / app.ip / app.company_id / app.talent_id.
- Global ValidationPipe, global exception filter mapping Postgres errors (23514, 23505, P0001)
  to 409/422 with a readable message, Swagger at /api/docs, @nestjs/config with validation
  of env vars, /api/v1/health endpoint.
- npm script `db:test:reset` that recreates the test database from the SQL schema file
  (DATABASE_URL_TEST), and a Jest e2e setup using it.
Never run prisma migrate or db push.
```

## Prompt 3 — Auth review & fix (PLAN 0.3)

```
Read AGENTS.md (sections 3, 6) and PLAN.md item 0.3, plus CDC 3.2, 8.12 and NFR-03.

Review the existing auth module line by line BEFORE changing anything. Give me:
1. A table of issues: severity (critical/high/medium/low), file:line, problem, fix.
   Check at least: password hashing, JWT secret/expiry, refresh token rotation and storage
   (hashed in user_sessions), magic link + reset tokens (hashed, single use, expiry in
   auth_tokens), email verification, 2FA TOTP (mandatory for staff roles), rate limiting
   and lockout, user enumeration in error messages, RolesGuard + @Roles + @CurrentUser,
   what the JWT payload contains, logout/revocation.
2. The list of endpoints auth should expose, and which exist / are missing.
3. A step-by-step fix plan.
Wait for my approval, then implement step by step with tests after each step.
```

## Prompt 4 — Module template (use for every module in PLAN.md)

Replace `<X.Y Module name>` with the PLAN.md item, e.g. `1.7 Placements`.

```
Read AGENTS.md, PLAN.md item <X.Y Module name>, and the CDC sections listed for it in
docs/cdc.md. Look at existing modules in src/modules to follow the same patterns.

Give me a PLAN ONLY (no code):
1. Files you will create or change.
2. Endpoints: method, path, roles allowed, request DTO, response DTO, which fields are
   hidden for which role (FR-SEC-01/02).
3. Service methods and the business rules each one enforces (cite rule IDs from CDC §12
   and status transitions from CDC §6). Say which rules the DB already enforces (AGENTS.md §7)
   and how you will turn those DB errors into clear 422 responses.
4. Settings values you will read (never hard-coded).
5. Test list: one line per test, rule IDs in the test names, plus the CDC 17.2 cases that apply.
6. Open questions where the CDC is unclear.

After I approve, implement in small steps. After each step run build, lint and tests and
report results. At the end: update AGENTS.md §2, tick the box in PLAN.md, and propose a
commit message.
```

## Prompt 5 — Review before merging a module

```
Review the changes on this branch against AGENTS.md and the CDC sections for <module>.
Check: every endpoint has auth + roles + ownership checks; no hidden field leaks to clients
or talents; no hard-coded business numbers; money uses Decimal; computed columns never
written; every rule ID has a test; errors are readable. List issues by severity, then fix
only the ones I approve.
```

## Prompt 6 — When something breaks

```
This fails: <paste the error and the command you ran>.
Find the root cause before changing anything. Explain it in 3–5 lines, propose the smallest
fix, and tell me which tests prove it is fixed. Do not refactor unrelated code.
```
