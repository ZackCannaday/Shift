# Access and privacy contract

Status: approved for the production revamp on 2026-08-31.

## Authorization principles

- Deny access by default.
- Scope every customer record by workspace and, where applicable, site.
- Enforce permissions in the API and Supabase Row Level Security policies; hiding a control in the interface is not authorization.
- Use the Supabase service role only in trusted server-side code. Never expose it to the browser or embed script.
- Record security-relevant actions without storing secrets or visitor content unnecessarily.

## Fixed launch roles

| Role | Allowed responsibilities | Explicit restrictions |
| --- | --- | --- |
| Owner | Full workspace control, ownership transfer, team administration, integrations, exports, and workspace deletion | Ownership transfer and destructive workspace deletion require re-authentication and confirmation |
| Admin | Manage sites, team members below Owner, providers, goals, targets, settings, and reports | Cannot transfer ownership, remove the final Owner, or delete the workspace |
| Editor | Create and edit targets, rules, goals, and draft variants; request AI drafts | Cannot approve, publish, change traffic allocations, manage members, or access provider credentials |
| Approver | Review, approve, archive, and publish eligible variants; manage approved traffic allocations | Cannot manage members, ownership, billing, or provider credentials |
| Analyst | View reports and export authorized aggregate analytics | Cannot edit content, publish, change settings, or access secrets |

Owners and Admins may perform Editor and Approver duties. Each membership has one fixed role at launch. Custom permission builders are excluded from launch scope.

## Supabase enforcement

- Workspace membership is the root authorization relationship.
- Site access requires an active workspace membership and a role permitted for the requested operation.
- Row Level Security policies must cover direct client-accessible tables and reject cross-workspace reads and writes.
- Trusted API operations must still verify workspace, site, resource ownership, and role before using elevated database access.
- Invitations expire, are single-use, and cannot assign the Owner role.
- Removing a member invalidates active sessions and future access promptly.
- Provider credentials are encrypted or stored through an approved secrets boundary and are never returned after submission.

## Consent-aware operation

### Before analytics consent

Shift may evaluate transparent page context such as normalized URL path, campaign parameters, referrer category, and coarse device class without creating a persistent visitor profile. It may serve a safe rule-based result only when this can be done without analytics storage.

Before consent, Shift must not:

- persist visitor-level exposure or conversion events
- build cross-page or cross-site profiles
- perform fingerprinting or hidden enrichment
- infer sensitive or protected traits
- claim control/challenger measurement

When a stable experiment assignment cannot be maintained without consent, serve the original fallback.

### After analytics consent

Shift may create a site-scoped pseudonymous session identifier, persist eligible exposures and conversions, and include those events in control/challenger reporting.

Consent state must travel with each accepted event. Withdrawal stops new collection and triggers the configured deletion or anonymization workflow for identifiers that can be resolved.

Honor Global Privacy Control by disabling optional analytics and targeted personalization. Treat unknown consent as not granted for analytics collection.

## Tiered retention

| Data class | Default retention | End-of-life behavior |
| --- | --- | --- |
| Raw visitor/session identifiers and event rows | 90 days | Delete or irreversibly anonymize through a scheduled, verifiable job |
| Aggregated site analytics without visitor identifiers | 13 months | Delete expired reporting periods |
| Consent and deletion-request evidence | Minimum necessary legal/operational period | Store only required evidence and document the separate policy before launch |
| Workspace content and configuration | Until customer deletion or account closure | Export when authorized, then delete through the verified workspace purge workflow |

The production system must not silently extend retention. Failed cleanup jobs alert administrators and remain visible until resolved.

## Export and deletion

- Owners may export workspace configuration and authorized analytics.
- Visitor deletion requests use a site-scoped resolvable identifier; Shift must not require new sensitive data to process the request.
- Site deletion removes active configuration and schedules dependent data for verified purge.
- Workspace deletion requires re-authentication, explicit confirmation, and a recovery window defined before launch.
- Deletion jobs are idempotent, auditable, and tested against tenant-isolation boundaries.
- Backups follow a documented expiry schedule and cannot become an indefinite undeclared archive.

## Acceptance criteria

- Every protected API operation has an explicit minimum role.
- Direct database access cannot read or mutate another workspace's records.
- Editors cannot approve their own drafts unless their assigned role is Owner or Admin.
- Analysts cannot retrieve provider credentials or visitor-level raw data.
- Unknown or withdrawn consent produces no new analytics events.
- Raw visitor/session data expires after 90 days; aggregates expire after 13 months.
- Authorized export and deletion workflows are tested, tenant-scoped, and auditable.
- The embed script exposes no credentials, service-role keys, or reusable event secrets.
