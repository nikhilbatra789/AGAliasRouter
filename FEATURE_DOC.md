# Feature Documentation

This document lists implemented features in the current codebase and why each exists.

## 1) Global OpenAI/Anthropic-Compatible Endpoints

**What exists**
- Global OpenAI-style routes: `src/app/v1/models/route.ts`, `src/app/v1/chat/completions/route.ts`
- Global Anthropic-style route: `src/app/v1/messages/route.ts`
- Provider-alias mirrored routes under both:
  - `src/app/[providerAlias]/v1/*`
  - `src/app/api/[providerAlias]/v1/*`

**Business justification**
- Gives clients one stable API surface while backend providers can vary.
- Reduces integration cost for teams using mixed OpenAI/Anthropic SDK ecosystems.
- Enables controlled provider lock-in per path when needed (debugging, cost routing, tenancy patterns).

### Post-Feature Notes
- Current translation scope focuses on chat workloads; streaming is not implemented in MVP paths.
- Keep global routes backward-compatible; these are the external contract.

---

## 2) Alias-Based Model Routing + Strategy Control

**What exists**
- Mapping config + persistence: `src/server/config/model-mappings-config.ts`
- Selection engine: `src/server/routing/model-router.ts`
- Strategies: `round_robin` and `ordered`
- Runtime state persistence of round-robin position (`lastUsedIndex`)

**Business justification**
- Lets operators expose durable model names while changing upstream provider/model rows behind the alias.
- Supports resilience and cost control by distributing traffic (`round_robin`) or prioritizing preferred routes (`ordered`).
- Minimizes client-side operational churn when provider availability changes.

### Post-Feature Notes
- Router prefers healthy routes and can fall back to degraded routes.
- Failed/unhealthy/disabled/incomplete routes are filtered out before dispatch.

---

## 3) Cross-Provider Payload Translation (OpenAI <-> Anthropic)

**What exists**
- Translation modules: `src/server/translation/*`
  - `openai-to-anthropic.ts`
  - `anthropic-to-openai.ts`
  - `global-messages-routing.ts`
- Used when endpoint shape differs from selected provider family.

**Business justification**
- Prevents client lock-in to a single protocol while preserving provider optionality.
- Allows routing continuity even when best available upstream is in a different provider family.
- Reduces migration risk when teams change providers.

### Post-Feature Notes
- Translation constraints are enforced (e.g., non-streaming flow and compatibility assumptions).
- Keep translator behavior deterministic and auditable for support/debug.

---

## 4) Provider Pools + Manual/Live Model Management

**What exists**
- Provider pool persistence: `src/server/config/provider-pools-config.ts`
- Provider model fetch endpoint: `src/app/api/admin/provider-models/route.ts`
- Cache service: `src/server/models/models-cache-service.ts`
- Provider pool UI: `ProviderPoolsPage` in `src/features/ui-pages.tsx`

**Business justification**
- Centralizes provider credentials/endpoints and operational status.
- Combines API-fetched models with manual model entries for incomplete or custom upstream catalogs.
- Enables rapid onboarding/offboarding of provider accounts without app redeploy.

### Post-Feature Notes
- Provider numbers and custom names are key operator-facing identifiers.
- Cache invalidation and refresh cadence are core to route quality.

---

## 5) Health Checks (Provider + Model Row)

**What exists**
- Health engine: `src/server/health/health-check-service.ts`
- Admin API: `src/app/api/admin/health-checks/route.ts`
- Runtime scheduled checks: `src/server/runtime/runtime-jobs.ts`
- UI interactions in Provider Pools + Model Mappings pages.

**Business justification**
- Prevents routing to known bad providers/models, improving API reliability.
- Allows degraded-state tolerance instead of hard-fail behavior during transient incidents.
- Gives operations quick visibility and active remediation controls.

### Post-Feature Notes
- Health outcomes are status-aware (`healthy`, `degraded`, `unhealthy`, `failed`, `unknown`).
- Check timeout is configurable via app config and impacts operational sensitivity.

---

## 6) Provider-Level Rate Limiting Controls

**What exists**
- Rate limit service: `src/server/rate-limits/rate-limit-service.ts`
- Router integration in `src/server/routing/model-router.ts`
- Unit coverage: `tests/unit/rate-limit-service.test.ts`

**Business justification**
- Protects upstream providers from burst overload and quota exhaustion.
- Avoids cascading failures by rejecting/deferring requests when routes are temporarily saturated.
- Improves fairness when multiple aliases target overlapping providers.

### Post-Feature Notes
- Router raises retry-oriented errors when all candidate providers are currently limited.
- Rate-limit acquire/release lifecycle must remain paired in request flows.

---

## 7) Admin Authentication + Session Control

**What exists**
- Session/auth services: `src/server/auth/admin-session.ts`, `src/server/auth/client-api-auth.ts`
- Session API route: `src/app/api/admin/session/route.ts`
- Login screen: `LoginPage` in `src/features/ui-pages.tsx`

**Business justification**
- Separates control-plane access from customer-facing API usage.
- Protects sensitive operations (config edits, provider credentials, logs visibility).
- Enables operational accountability by restricting configuration writes.

### Post-Feature Notes
- Session behavior is cookie-based and scoped to admin UX.
- Keep auth handling minimal and explicit; avoid mixing with routing logic.

---

## 8) Control Plane UI (Dashboard + Configuration + Operations Pages)

**What exists**
- Screen implementations in `src/features/ui-pages.tsx`:
  - `DashboardPage`
  - `ConfigurationPage`
  - `ProviderPoolsPage`
  - `ModelMappingsPage`
  - `CredentialFilesPage`
  - `RealtimeLogsPage`
- Layout shell: `src/components/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`
- Shared UI primitives: `src/components/Primitives.tsx`

**Business justification**
- Enables non-code operations for day-2 management.
- Reduces mean time to detect and resolve routing/provider incidents.
- Makes policy changes (timers, keys, mappings) faster and less error-prone.

### Post-Feature Notes
- UI behavior depends on admin API routes in `src/app/api/admin/*`; keep contract stability high.
- Responsive behavior and modal flows are already implemented for key pages.

---

## 9) Credential File Access + Config Bundle Download

**What exists**
- Credential files API: `src/app/api/admin/credential-files/route.ts`
- UI: `CredentialFilesPage` with view/download/delete and zip download support.

**Business justification**
- Supports backup/recovery and auditable config inspection.
- Reduces friction for environment migration and incident response.
- Avoids shell-only operational dependency for common admin tasks.

### Post-Feature Notes
- Destructive actions (delete) exist in UI; use role/security controls appropriately.
- Config zip path should remain stable for operator automation.

---

## 10) Logging + Real-Time Log Viewer

**What exists**
- Log service: `src/server/logging/log-service.ts`
- Admin log API: `src/app/api/admin/logs/today/route.ts`
- UI: `RealtimeLogsPage`
- Secret masking in logs and 7-day retention pruning.

**Business justification**
- Provides near-real-time observability of routing, health, and upstream failures.
- Accelerates debugging by exposing request/response traces (masked/unmasked UI toggle).
- Supports forensic and compliance-lite operational workflows with downloadable daily logs.

### Post-Feature Notes
- Masking is implemented server-side before persistence; preserve this invariant.
- Retention automation is tied to runtime jobs; verify timer settings in production.

---

## 11) Runtime Jobs + Startup Validation

**What exists**
- Runtime scheduler: `src/server/runtime/runtime-jobs.ts`
- Startup validation: `src/server/runtime/startup-validation.ts`
- Triggered from `src/app/layout.tsx`

**Business justification**
- Ensures service self-maintenance (cache refresh, health checks, log pruning) without external schedulers.
- Prevents unsafe startup when required JSON config shape is invalid.
- Stabilizes long-running deployments with predictable background maintenance.

### Post-Feature Notes
- Jobs are singleton-guarded at process level.
- Runtime reload path exists and should be used after config timer updates.

---

## 12) Queued Feature: End-to-End Streaming + Provider Stream Capability Controls

**Status**
- Queued as `TASK-2026-05-14-002` in `PENDING_TASKS.md` (owner: Cody, priority: P0).
- Not implemented yet in the current codebase.

**Planned implementation scope**
- Enable streaming for:
  - OpenAI-compatible `/v1/chat/completions` (global + path-lock)
  - Anthropic-compatible `/v1/messages` (global + path-lock)
- Add cross-family stream translation:
  - OpenAI request shape routed to Anthropic upstream with streaming translation back.
  - Anthropic request shape routed to OpenAI upstream with streaming translation back.
- Add provider config toggle `supportsStreaming` (add/edit provider flows + persistence).
- Add graceful downgrade behavior when `supportsStreaming=false`:
  - drop stream flags,
  - continue request as non-stream,
  - do not hard fail due to stream capability mismatch.
- Add Playground streaming toggle for operator testing.
- Standardize stream failure behavior: emit immediate protocol-compatible error event/chunk then close.
- Enforce health safety: health-check jobs and health endpoints must always be non-stream.

**Business justification**
- Improves UX for interactive clients that depend on incremental output.
- Preserves compatibility with providers that do not support streaming.
- Reduces health-path risk by forcing deterministic non-stream checks.

**Post-Feature Notes**
- Until this task is completed, current production behavior remains non-stream for these routes.
