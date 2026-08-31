# Onboarding, providers, and launch contract

Status: approved for the production revamp on 2026-08-31.

## Guided onboarding outcome

A new Owner should reach a verified, controlled first personalization without needing Shift staff to configure the account. Progress is saved after every step and can be resumed safely.

## Setup wizard

1. **Create workspace** — confirm workspace name, Owner identity, and required policy acknowledgments.
2. **Add site** — collect the canonical site origin, display name, allowed environments, and ownership/authorization confirmation.
3. **Install Shift** — provide the site-specific embed snippet and framework-neutral installation guidance.
4. **Verify installation** — prove the script loads from the expected origin, receives a valid site configuration, and does not expose secrets.
5. **Configure consent** — connect the site's consent state or select the documented no-analytics fallback behavior.
6. **Create first goal** — select a goal template or define a validated custom event.
7. **Create first target** — select a supported copy target and preserve the original text as the safe fallback.
8. **Draft and approve** — author or request AI drafts, then require an authorized human approval.
9. **Set traffic** — configure valid control/challenger percentages totaling 100 percent.
10. **Run preflight** — verify origin, consent, target, approved variant, goal, allocation, and fallback behavior before activation.

The wizard must show plain-language status, the exact failed check, and the safest next action. It must not report “installed,” “tracking,” or “live” without evidence.

## Installation verification

Verification must cover:

- exact allowed origin
- embed response success
- signed event-token issuance
- absence of browser-visible credentials
- target selector resolution
- safe fallback preservation
- consent state detection
- authorized goal event acceptance
- stable control/challenger assignment after consent
- no draft or archived content served

Production activation remains blocked when a critical check fails.

## Multi-provider BYO credentials

Launch adapters:

- OpenAI
- Anthropic
- Google

The internal provider interface must remain vendor-neutral. Adding another provider should require a new adapter and conformance tests, not changes throughout content workflows.

Each adapter must implement:

- credential validation
- supported model discovery or an approved model allowlist
- draft-generation request normalization
- structured result validation
- timeout, cancellation, and rate-limit handling
- provider-specific error translation into safe human-readable messages
- usage metadata without logging prompts, credentials, or sensitive output unnecessarily

## Credential and AI safety

- Customers supply and control their provider credentials.
- Credentials are scoped by workspace and provider and stored only through the approved server-side secrets boundary.
- Credentials are write-only after submission and never returned through APIs, logs, exports, browser storage, or the embed script.
- A credential validated for one provider cannot be reused silently for another.
- AI generates drafts only. It cannot approve, publish, change allocations, or execute during live visitor requests.
- Provider outages leave existing approved personalization and fallback behavior operational.
- Removing a credential stops future generation but does not delete approved content or its attribution history.

## Private beta

The initial release is invitation-only. Billing is not activated until pricing, limits, tax handling, refunds, and payment operations receive separate approval.

Beta admission requires:

- an identified workspace Owner
- an authorized test site
- agreement to beta limitations and privacy responsibilities
- a supported installation path
- a feedback and incident contact

Capture real usage dimensions during beta without enforcing paid limits. Do not use fabricated customer or performance data.

## Planned subscription families

The post-beta packaging will use three subscription families:

| Tier | Intended customer | Planned packaging direction |
| --- | --- | --- |
| Starter | A small growth team launching on limited sites | Core personalization, goals, controlled experiments, essential reporting, and modest usage limits |
| Growth | Teams operating several sites or higher traffic | Higher usage limits, more seats and sites, advanced reporting, and expanded integrations |
| Scale | Organizations requiring larger volume and controls | Highest limits, stronger governance, priority support, and negotiated operational requirements |

Exact prices, trials, quotas, overages, included seats, AI-operation limits, and feature gates are intentionally undecided. They require a separate pricing decision informed by verified infrastructure costs and beta usage.

## Metering dimensions

Measure during beta:

- active sites
- eligible sessions
- consented exposures and conversions
- stored raw events and aggregate reporting volume
- workspace seats by role
- AI draft requests by provider
- export and deletion job volume
- API and embed bandwidth
- operational support burden

Metering must be tenant-scoped, auditable, and excluded from customer billing until billing is explicitly enabled.

## Beta exit gates

Do not begin public paid subscriptions until:

- Supabase migrations and rollback are proven
- tenant isolation and fixed-role authorization tests pass
- provider adapters pass conformance, failure, and credential-leak tests
- onboarding installation and preflight work end to end
- consent, retention, export, and deletion jobs are verified
- attribution and reports use persisted real events
- Playwright desktop, mobile, keyboard, and accessibility gates pass
- monitoring, alerting, incident response, backups, and recovery are documented and tested
- customer-facing legal, support, billing, and status materials are approved
- no unresolved launch-blocking security, data-integrity, or reliability defect remains
- the user explicitly approves public deployment and billing activation

## Acceptance criteria

- A new Owner can resume onboarding without repeating completed verified steps.
- A site cannot activate until critical preflight checks pass.
- OpenAI, Anthropic, and Google adapters satisfy the same provider contract.
- Provider credentials never cross workspace boundaries or appear in client-visible surfaces.
- AI failure cannot interrupt approved runtime personalization.
- Beta usage is measured using real tenant-scoped events without charging customers.
- Pricing remains uncommitted until the separate pricing phase is approved.
