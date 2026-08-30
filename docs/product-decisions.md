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

## Change policy

- Routine correctness, security, accessibility, testing, performance, and maintainability fixes may be applied automatically.
- Major changes to the product concept, architecture, hosting model, design identity, primary workflow, pricing, privacy posture, or launch scope require explicit user confirmation.
- No deployment or public release occurs without a final evidence review and explicit approval.
