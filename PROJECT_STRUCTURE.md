# Project Structure

## Top-Level

- `src/` — application source (UI, routes, server services)
- `tests/` — unit and end-to-end tests
- `docs/` — supplemental internal docs (e.g., API notes)
- `Chat API Specs/` — protocol/translation reference documents
- `scripts/` — development utility scripts
- `Dockerfile`, `docker-compose.yml` — container packaging/deployment
- `README.md` — operator-facing product overview and run instructions

## Source Layout (`src/`)

### `src/app/` (Next.js App Router)

- UI pages:
  - `src/app/login/page.tsx`
  - `src/app/dashboard/page.tsx`
  - `src/app/configuration/page.tsx`
  - `src/app/provider-pool/page.tsx`
  - `src/app/model-mapping/page.tsx`
  - `src/app/credential-files/page.tsx`
  - `src/app/real-time-logs/page.tsx`
- Global customer API routes:
  - `src/app/v1/models/route.ts`
  - `src/app/v1/chat/completions/route.ts`
  - `src/app/v1/messages/route.ts`
- Provider-locked mirrors:
  - `src/app/[providerAlias]/v1/*`
  - `src/app/api/[providerAlias]/v1/*`
- Admin API routes:
  - `src/app/api/admin/*` (session, dashboard, config, pools, mappings, health, logs, credential files, provider models)

### `src/features/`

- `ui-pages.tsx` — concrete implementations of all major admin screens.
- `api-client.ts` — browser-side admin API wrapper used by UI pages.

### `src/components/`

- `AppShell.tsx` — layout frame that composes sidebar/topbar/main content.
- `Sidebar.tsx` — navigation + logout.
- `TopBar.tsx` — breadcrumb and system health indicator.
- `Primitives.tsx` — shared reusable UI atoms/molecules.

### `src/server/`

- `routing/` — route resolution and provider dispatch logic.
- `translation/` — OpenAI/Anthropic payload conversion.
- `health/` — provider/model health-check execution and classification.
- `models/` — model cache and provider model hydration.
- `rate-limits/` — provider rate-limit acquire/check/release.
- `config/` — JSON-backed config read/write and validation helpers.
- `auth/` — admin session and API key auth logic.
- `logging/` — structured log append/read/prune with secret masking.
- `runtime/` — startup validation and recurring maintenance jobs.
- `dashboard/` — aggregated metrics for control-plane dashboard.
- `providers/` — upstream HTTP client adapters.
- `errors/` — API error response helpers.
- `credentials/` — credential/config file access operations.

### `src/shared/`

- Shared TypeScript types and mock data helpers used across UI/server.

## Tests

- `tests/unit/*` — unit tests for routing/rate-limit behavior.
- `tests/e2e/*` — Playwright coverage for UI and major user flows.

## Architecture Rule (Mandatory)

**Any backend-integrated feature must use API-based architecture.**

Concretely:
- UI code must call route handlers (`/api/admin/*`, `/v1/*`, or alias routes), not server modules directly.
- Route handlers should orchestrate server services and return typed JSON responses.
- Server services remain framework-agnostic where possible and should not depend on client/UI state.

This rule is required to keep boundaries clear, preserve testability, and support deployment/runtime portability.
