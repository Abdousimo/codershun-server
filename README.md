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

- `GET /v1/` - API metadata
- `GET /v1/health` - health check
- `POST /v1/auth/register` - create a talent account
- `POST /v1/auth/login` - issue access and refresh tokens
- `POST /v1/auth/refresh` - issue a new access token
- `POST /v1/auth/logout` - revoke a refresh session
- `GET /v1/auth/me` - return the authenticated principal
- `GET|PATCH|DELETE /v1/users` - users (authentication required)
- `GET|PATCH|DELETE /v1/users/:id` - one user
- `GET /v1/api/resources/:resource` - list any schema resource
- `GET /v1/api/resources/:resource/:id` - fetch one record
- `POST /v1/api/resources/:resource` - create a record
- `PATCH /v1/api/resources/:resource/:id` - update a record
- `DELETE /v1/api/resources/:resource/:id` - delete a record

Resource names use kebab-case table names, for example `talent-requests`,
`shortlist-items`, `placements`, and `invoice-lines`. List endpoints support
`skip`, `take` (maximum 100), `orderBy`, and a JSON `where` query parameter.
