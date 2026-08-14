# Shift

Traffic-aware website personalization with customer-selectable AI providers, a no-AI rules fallback, and conversion analytics.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required for external provider credentials: `SHIFT_ENCRYPTION_KEY` — base64-encoded 32-byte key

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/shift` — React dashboard, onboarding, and self-demonstrating landing page
- `artifacts/api-server` — Express API, embed script, provider adapters, auth, and analytics
- `lib/db/src/schema` — database source of truth
- `lib/api-spec/openapi.yaml` — generated-client contract; keep aligned with routes

## Architecture decisions

- Browser embeds use publishable site identifiers; dashboard authorization uses HttpOnly sessions.
- All visitor records and analytics queries are scoped to a site ID.
- External provider credentials are encrypted at rest and decrypted only for server-side requests.
- Every provider returns the same Zod-validated personalization result.
- Rules mode is the default and fallback so the page never depends on an external AI service.

## Product

Customers install one script, mark approved content targets with data attributes, select an AI provider or rules mode, and review visitor, persona, conversion, and session telemetry.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Apply DB schema changes before starting this branch.
- Never use the publishable site key to authorize dashboard routes.
- External providers require `SHIFT_ENCRYPTION_KEY`; rules mode does not.
- Full workspace typecheck still includes generated Replit integration packages; validate the two product artifacts separately when unrelated generated-package errors occur.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
