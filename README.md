# Coders Hub backend

NestJS API backed by PostgreSQL and Prisma 7. The Prisma schema is generated from
[`coders_hub_schema.sql`](./coders_hub_schema.sql) and covers the platform's 90
tables and 51 PostgreSQL enums.

## Setup

```bash
pnpm install
copy .env.example .env
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm exec prisma db seed
pnpm dev
```

Set `DATABASE_URL` to a PostgreSQL 15+ connection string before running migrations.
The migration enables the `pgcrypto`, `citext`, and `pg_trgm` extensions.
Set `AUTH_SECRET` to a random value of at least 32 characters. It signs access
tokens; never commit it to source control.

## API

The server listens on port `3001` by default. Set `PORT` to override it.

- `GET /api/v1/` - API metadata
- `GET /api/v1/health` - health check
- `GET /api/docs` - interactive Swagger UI (development only)
- `GET /api/docs-json` - raw OpenAPI JSON document (development only)

Swagger lists the complete endpoint catalog, request DTOs, response schemas, enums,
authentication requirements, role-protected routes and pagination query parameters.
Use **Authorize** in the Swagger UI with a JWT access token from `/api/v1/auth/login`.

Resource names use kebab-case table names, for example `talent-requests`,
`shortlist-items`, `placements`, and `invoice-lines`. List endpoints support
`skip`, `take` (maximum 100), `orderBy`, and a JSON `where` query parameter.
