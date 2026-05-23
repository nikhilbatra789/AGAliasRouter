# Timeline

Derived from current repository history (`git log`) on `main`.

## Commit Timeline (git-style)

- `2026-04-28 12:24:44 +0530` — `b3a044d` — `Completing MVP`
- `2026-04-28 13:15:59 +0530` — `8236f1d` — `Fixing the Docker Build Problem`
- `2026-04-28 13:51:08 +0530` — `a21a7cd` — `Fix Docker build source exclusions`
- `2026-04-28 13:51:53 +0530` — `a75482b` — `Fix Docker build source exclusions`
- `2026-04-28 22:55:39 +0530` — `9c96ad8` — `Added helath check time out, Added Seach in model mappings`
- `2026-05-04 21:09:55 +0530` — `73fc342` — `Improve health checks, routing UI states, and dashboard visibility`
- `2026-05-06 19:25:19 +0530` — `5d57233` — `add provider model fetch and config zip download`
- `2026-05-06 20:11:03 +0530` — `84954c3` — `Added Rate Limiting`
- `2026-05-06 20:36:44 +0530` — `97df039` — `Adding Global Chat Completions`

## Release Notes (Markdown)

## MVP Baseline — 2026-04-28

### Included
- Initial control-plane and routing baseline (MVP).
- Core config model and provider/model management foundations.

### Operational impact
- Established a deployable self-hosted middleware starting point.

---

## Docker Build Stabilization — 2026-04-28

### Included
- Multiple commits focused on Docker build correctness and source exclusion fixes.
- Improved reproducibility of image builds.

### Operational impact
- Reduced container build failures and deployment friction.

---

## Health Timeout + Mapping Search UX — 2026-04-28

### Included
- Health check timeout support.
- Search capability added for model mappings UI interactions.

### Operational impact
- Better resiliency against hanging checks.
- Faster operator navigation of large mapping sets.

---

## Health/Routing/Dashboard Improvements — 2026-05-04

### Included
- Health-check behavior refinements.
- Routing UI state improvements.
- Better dashboard visibility for system condition.

### Operational impact
- Improved day-2 observability and lower triage time.

---

## Provider Models + Config Zip Export — 2026-05-06

### Included
- Provider model fetch support in admin API/UI flows.
- Download-all configuration as zip from credential files workflow.

### Operational impact
- Better provider-model discovery.
- Easier backup and migration operations.

---

## Provider Rate Limiting — 2026-05-06

### Included
- Route-level provider rate-limit integration.
- Supporting unit tests around rate-limit behavior.

### Operational impact
- Better upstream protection and reduced overload cascades.

---

## Global Chat Completions Expansion — 2026-05-06

### Included
- Added global chat completions capability as a first-class route path.

### Operational impact
- Simplified client usage for shared/global model aliases.

---

## Queued: End-to-End Streaming Support + Provider Capability Controls — 2026-05-14

### Status
- Queued in `PENDING_TASKS.md` as `TASK-2026-05-14-002` (owner: Cody, priority: P0).

### Planned scope
- Full streaming across both endpoint families in phase one:
  - OpenAI-compatible `/v1/chat/completions` (global + path-lock)
  - Anthropic-compatible `/v1/messages` (global + path-lock)
- Cross-family streaming translation (OpenAI ↔ Anthropic).
- Provider-level streaming capability toggle: `supportsStreaming`.
- Graceful downgrade behavior when `supportsStreaming=false`:
  - Strip incoming stream flags.
  - Continue request in non-stream mode (no hard error).
- Playground streaming toggle for operator testing.
- Explicit stream error behavior: immediate error event/chunk then close.
- Health guardrail: all health-check jobs and health endpoints must force non-stream behavior.

### Expected operational impact
- Adds real-time token/event delivery where supported.
- Preserves reliability for non-stream-compatible providers via controlled downgrade.
- Avoids accidental stream usage in health systems.
