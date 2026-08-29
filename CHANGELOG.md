# Changelog

All material Shift changes are recorded here. Dates use UTC.

## Unreleased

### Added

- Site-scoped content targets for headlines, subheadlines, and calls to action.
- Versioned draft, approved, and archived content variants with audit fields.
- Conversion goals and one active control/challenger allocation per target.
- Authenticated, tenant-scoped content management API routes.
- Short-lived signed event authorization for embed conversions and session events.
- Focused content-contract, embed-script, event-token, and runtime-security tests.

### Security

- Production rejects development authentication tokens at startup.
- Dashboard session cookies are secure except explicit HTTP loopback development.
- Reverse-proxy trust requires an exact configured address, CIDR, or named subnet.
- Authenticated mutations require the configured same origin.
- Added request body limits, response security headers, and parser error handling.
- Provider credentials cannot be reused when switching AI providers.
- Local environment files are ignored while `.env.example` remains tracked.
- Patched production dependency advisories in `body-parser` and `qs`.

### Changed

- Embed result caching is scoped by site and page.
- Embed event tokens stay private to the script runtime and page-scoped session cache.
- Runtime content selection now applies only approved challenger content or the persisted safe fallback.
- Stable control/challenger assignment is scoped by site, session, target, and normalized page path.
- Package build-script allowlisting now uses explicit boolean policy entries.

### Verification

- Library, API, and frontend type checks pass.
- API tests pass; the PostgreSQL integration test remains skipped without `TEST_DATABASE_URL`.
- API and frontend production builds pass.
- Production dependency audit reports no known vulnerabilities.

### Pending release gates

- Test both migrations against a disposable PostgreSQL copy and prove rollback.
- Add the customer-facing content and goal management workflow.
- Add persisted allocation attribution and variant-performance analytics.
- Complete browser-based desktop, mobile, keyboard, and accessibility verification.
