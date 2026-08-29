# Shift

Shift is a traffic-aware website personalization engine. A customer installs one publishable script, chooses an AI provider or the built-in rules engine, and measures approved headline and CTA variants against real conversion events.

## Current checkpoint

This branch contains the first two production-foundation checkpoints:

- publishable `pk_shift_` site keys are separate from dashboard authentication
- dashboard access uses hashed, expiring HttpOnly sessions
- every analytics and visitor query is scoped to the authenticated site
- visitor identity is unique per site, not globally
- embed requests enforce the configured website origin
- conversion and time-on-site events are captured by the embed
- OpenAI, Anthropic, Google Gemini, Groq, and no-AI rules mode share one validated provider contract
- customer provider keys are encrypted at rest with AES-256-GCM
- provider failures fall back to the conservative rules experience
- signed, short-lived event authorization binds telemetry to a detected site session
- customer content targets, approved variant versions, goals, and control allocations have authenticated APIs
- new workspaces remain pending until their owner verifies a one-time email link
- users, organizations, memberships, and sites now have explicit ownership boundaries
- sessions bind a verified user to an active site and re-check membership on every dashboard request
- registration, login, detection, and event limits use shared PostgreSQL counters instead of process memory
- credentialed dashboard APIs are same-origin; only the public embed API accepts cross-origin requests
- a versioned migration upgrades existing accounts and preserves their access

## Run locally

Requirements: Node.js 24, pnpm, and PostgreSQL.

```bash
cp .env.example .env
pnpm install
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/api-server run dev
```

The web artifact is normally started by Replit. To run it directly, provide `PORT` and `BASE_PATH`:

```bash
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/shift run dev
```

## Install the embed

```html
<script
  src="https://YOUR_SHIFT_HOST/api/shift.js"
  data-shift-key="pk_shift_..."
  data-shift-auto="true"
></script>

<h1 data-shift-headline>Your approved default headline</h1>
<p data-shift-subheadline>Your approved default subheadline</p>
<button data-shift-cta data-shift-conversion="primary_cta">Get started</button>
```

Manual goals can be recorded with `window.Shift.track("signup")` after the `shift:ready` event.

## Provider model

Provider credentials are entered after dashboard authentication and never returned by the API. `SHIFT_ENCRYPTION_KEY` must be a base64-encoded 32-byte key before an external provider can be configured. Rules mode requires no external credential and is the safe default.

## Security notes

- A publishable site key identifies a site; it does not authorize dashboard access.
- Provider keys must never be placed in the embed or browser storage.
- Production deployments must configure HTTPS and a durable, distributed rate limiter.
- Production deployments must provide a unique `EVENT_SIGNING_KEY` with at least 32 UTF-8 bytes.
- The stored website hostname is the embed origin allowlist for the first release.
- Production email verification requires `PUBLIC_APP_URL`, `RESEND_API_KEY`, and a `SHIFT_FROM_EMAIL` address on a verified sending domain.
- `ALLOW_DEV_AUTH_TOKENS` must remain disabled outside local development.
- Run `pnpm --filter @workspace/db run migrate` before deploying this branch.
- Expired rate-limit buckets are intentionally retained for auditability in this checkpoint; add scheduled retention before high-volume production use.

## Validation

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/shift run typecheck
pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/api-server run build
PORT=4173 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/shift run build
```
