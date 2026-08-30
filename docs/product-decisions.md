# Shift product decisions

This file records user-approved product and production decisions for the isolated production revamp. Major changes require explicit confirmation before implementation.

## Approved on 2026-08-30

### Production foundation

- Preserve the existing React/Vite frontend, Express API, and PostgreSQL data model.
- Replace Replit hosting with a Vercel frontend and Supabase-managed PostgreSQL/backend services.
- Use local Playwright for repeatable desktop, mobile, keyboard, and accessibility verification.
- Keep the archived Replit-era branch unchanged as the recoverable source baseline.

### Product direction

- Primary launch user: growth teams, especially technical marketers and growth engineers.
- Account model: one workspace can manage multiple websites.
- Core outcome: personalize approved website content and calls-to-action to visitor intent, then measure results.

### Personalization signals

- Start with transparent, first-party web signals: normalized URL path, UTM campaign parameters, referrer category, and coarse device class.
- Let each workspace define readable conditions and priority order; show why a visitor matched a rule.
- Do not use fingerprinting, hidden enrichment, sensitive traits, or inferred protected characteristics.
- Use deterministic rule precedence and a persisted safe fallback when no rule matches.

### AI authority

- AI may draft variants and explain its reasoning, but it cannot approve, publish, or directly serve generated content.
- Generated drafts remain private to authorized workspace members until explicitly approved.
- Runtime requests must never generate content synchronously; they may only select among approved variants and the safe fallback.
- Keep provider credentials isolated by provider and workspace, with server-side validation and redaction.

### Publishing safety

- Require explicit human approval before a variant becomes runtime-eligible.
- Preserve the lifecycle: draft → approved → archived. Archiving removes future eligibility without deleting historical attribution.
- Use deterministic control/challenger allocation, signed event attribution, and automatic fallback when an allocation or variant is invalid.
- Record who approved a variant and when; future changes create a new revision instead of silently mutating served content.

## Change policy

- Routine correctness, security, accessibility, testing, performance, and maintainability fixes may be applied automatically.
- Major changes to the product concept, architecture, hosting model, design identity, primary workflow, pricing, privacy posture, or launch scope require explicit user confirmation.
- No deployment or public release occurs without a final evidence review and explicit approval.
