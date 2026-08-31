# Content and measurement contract

Status: approved for the production revamp on 2026-08-31.

## Launch content scope

Shift may personalize these customer-defined targets:

- headline
- subheadline
- call to action
- short supporting text

Each target belongs to one workspace site and one normalized page scope. A target stores a stable selector, human-readable label, safe fallback content, and lifecycle state. The runtime may apply only an approved variant or the stored fallback.

Images, arbitrary HTML, scripts, styles, forms, and complete section replacement are excluded from the launch scope.

## Future installment: complete sections

Complete page-section replacement is planned as a future installment, not silently discarded. It requires a separately approved design and security contract covering:

- versioned section templates or components
- sanitization and content-security policy compatibility
- responsive and accessibility validation
- asset storage and image handling
- rollback and visual-regression evidence
- compatibility boundaries for customer frameworks

This future capability must not be implemented as unrestricted HTML injection.

## Goal model

Shift provides templates for:

- link or button click
- form submission
- booking completion
- purchase completion
- custom event

Customers may create custom goals with a stable name and validated event key. Every goal is site-scoped. Goal definitions cannot execute customer-provided JavaScript.

A conversion event must be authorized, bound to the correct site and session, associated with an active goal, and deduplicated before attribution.

## Control and challenger policy

- The original page content is the control.
- Only approved variants may be challengers.
- Workspace members may configure traffic percentages; allocations must be valid and total 100 percent.
- Assignment is deterministic for the same site, session, page, and target.
- Assignment attribution is persisted before performance is reported.
- Invalid or unavailable assignments fall back safely to original content.
- Archiving a variant prevents future assignment without deleting historical results.

## Reporting contract

Report at minimum:

- eligible sessions
- control and challenger exposures
- attributed conversions
- conversion rate by allocation
- absolute and relative lift
- date range and goal filters

Shift must distinguish “insufficient evidence” from a winning or losing result. Launch reporting must not make statistical-confidence claims until minimum-sample and significance rules are separately approved and implemented.

## Acceptance criteria

- A workspace can create a supported target and preserve its original fallback.
- AI-generated text remains a draft until a human approves it.
- The runtime never serves drafts, archived variants, arbitrary HTML, or synchronous AI output.
- A customer can create a templated or custom goal without adding executable code.
- Control and challenger assignments remain stable and attributable.
- Reports never combine data across workspaces or sites.
- Removing or archiving content does not erase historical attribution.
