# Pending Tasks

This file is intentionally initialized empty.

## Workflow States
- Pending
- Queued
- Processing
- Done

## Task Entry Template

```md
### TASK-YYYY-MM-DD-XXX — <short title>
- State: Pending | Queued | Processing | Done
- Priority: P0 | P1 | P2 | P3
- Owner: <name/role>
- Created: <YYYY-MM-DD HH:MM TZ>
- Updated: <YYYY-MM-DD HH:MM TZ>
- Scope:
  - <what is in>
  - <what is out>
- Dependencies:
  - <systems/people/tasks>
- Acceptance Criteria:
  - [ ] <criterion 1>
  - [ ] <criterion 2>
- Notes:
  - <context>

#### Questions — Unresolved
- [ ] <question requiring answer>

#### Questions — Resolved
- [x] <question> → <answer/decision>
```

## Current Queue

### TASK-2026-05-12-001 — Build Playground UI and chat flow
- State: Done
- Priority: P1
- Owner: Cody
- Created: 2026-05-12 18:55 UTC
- Updated: 2026-05-14 06:06 UTC
- Scope:
  - Add new left menu item labeled "Playground"
  - Add model dropdown sourced from global `/models` API
  - Add chat UI with right-aligned user bubbles and left-aligned model bubbles
  - Add error bubble on left with retry icon/action
  - Retry resends last user prompt using same selected model and appends new bubble
  - Use chat completions API for sending prompts
- Dependencies:
  - Existing global `/models` endpoint availability
  - Existing chat completions API route availability
- Acceptance Criteria:
  - [x] Sidebar shows "Playground" entry and route is accessible
  - [x] Dropdown placeholder shows "Select your model"
  - [x] Dropdown lists model names from `/models`
  - [x] Send is blocked until model is selected
  - [x] User and model messages render in correct left/right bubble alignment
  - [x] On model error, left bubble shows error with retry icon/button
  - [x] Retry appends a new attempt bubble flow and uses same model + last user prompt
  - [x] Chat remains single-thread and in-memory
- Notes:
  - MVP only; advanced controls (temperature/max_tokens/system prompt) are out of scope for now.
  - 2026-05-13 nightly run: implementation completed on branch `feat/TASK-2026-05-12-001-auto`; `npm run test:unit` and `npm run build` passed.
  - 2026-05-13 nightly run: e2e blocked. `npm run test:e2e -- tests/e2e/epic-1-ui.spec.ts` first failed due missing browser executable (fixed via `npx playwright install chromium`), then failed with `Test timeout of 30000ms exceeded while setting up "page"` / `browserContext.newPage` in this environment.
  - 2026-05-14 completion run: updated Playground model selector to keep explicit placeholder (`Select your model`) and added targeted e2e coverage at `tests/e2e/playground-flow.spec.ts`.
  - 2026-05-14 completion run: `npm run test:unit` ✅, `npm run build` ✅, `npm run test:e2e -- tests/e2e/playground-flow.spec.ts` ✅.

#### Questions — Unresolved
- [ ] None

#### Questions — Resolved
- [x] API choice → Use chat completions
- [x] Menu label → "Playground"
- [x] Chat persistence → In-memory single-thread
- [x] Retry behavior → Resend last prompt on same model and append new bubble

### TASK-2026-05-14-002 — End-to-end streaming support with provider stream capability controls
- State: Processing
- Priority: P0
- Owner: Cody
- Created: 2026-05-14 13:02 UTC
- Updated: 2026-05-14 20:42 UTC
- Scope:
  - Enable full cross-family streaming in phase one for:
    - Global OpenAI endpoint (`/v1/chat/completions`)
    - Path-lock OpenAI endpoint (`/[providerAlias]/v1/chat/completions`)
    - Global Anthropic endpoint (`/v1/messages`)
    - Path-lock Anthropic endpoint (`/[providerAlias]/v1/messages`)
    - Anthropic `/v1/messages` parity across global + path-lock flows (this is the required counterpart to chat completions)
  - Add provider-level streaming capability toggle in both add-provider and edit-provider UX flows.
  - Add backend configuration persistence for provider streaming capability toggle (`supportsStreaming`).
  - Add Playground streaming option toggle to allow testing with stream on/off.
  - Enforce **non-stream** behavior for health systems regardless of request flags:
    - Health-check jobs must always send non-stream requests.
    - Health endpoints must always process and forward as non-stream.
    - Even if callers send stream flags to health paths, ignore/drop stream flags.
  - Implement stream behavior when upstream provider capability is disabled:
    - Do **not** throw error
    - Drop `stream`/stream-related flags before upstream call
    - Continue request in non-stream mode
  - Support OpenAI `stream_options.include_usage` in stream output.
  - Enforce stream error behavior: immediate stream error chunk + close.
- Dependencies:
  - Provider pool config schema and admin APIs (provider create/update endpoints).
  - Existing non-stream translation layer for OpenAI↔Anthropic.
  - Runtime route handlers for global/path-lock chat-completions + messages endpoints in repo.
- Acceptance Criteria:
  - [ ] `stream: true` works for OpenAI-compatible client paths and Anthropic-compatible client paths, including cross-family routing translation in phase one.
  - [ ] OpenAI stream output emits usage chunk when `stream_options.include_usage=true`.
  - [ ] Upstream stream failures emit immediate error chunk/event and close stream (no trailing normal completion).
  - [ ] Provider form includes `supportsStreaming` toggle on create + edit; value persists to config and survives restart.
  - [ ] If provider streaming capability is disabled, router strips stream flags and executes non-stream request without throwing unsupported-stream error.
  - [ ] Same stream-capability fallback behavior applies to global + path-lock chat-completions routes and global + path-lock `/v1/messages` routes.
  - [ ] Health-check jobs and health endpoints always run non-stream; stream flags are ignored/dropped for health flows.
  - [ ] Playground has UI toggle to send stream mode; when stream is disabled at provider level, request still succeeds in non-stream mode.
  - [ ] Unit tests added for stream parsers/translators, provider-capability downgrade logic, and include_usage behavior.
  - [ ] E2E tests added for global/path-lock + cross-family stream flows, disabled-stream-provider downgrade path, and Playground stream toggle UX.
  - [ ] `docs/internal-api.md` and any endpoint docs updated to reflect new streaming semantics and provider capability behavior.
- Notes:
  - Current implementation explicitly blocks stream in route handlers and provider clients parse JSON bodies directly; streaming relay/translation path must be added.
  - Must keep backward compatibility for existing non-stream requests and existing provider configs.
  - For disabled stream capability downgrade, remove at least: `stream`, `stream_options` (OpenAI), and equivalent stream markers before forwarding upstream.
  - For OpenAI→Anthropic and Anthropic→OpenAI stream translation, implement stateful chunk/event translators and deterministic close semantics.
  - 2026-05-14 nightly run: implemented streaming infrastructure + provider `supportsStreaming` persistence + docs/unit tests on branch `feat/TASK-2026-05-14-002-auto`; `npm run test:unit` and `npm run build` passed.
  - 2026-05-14 nightly run failure: `npm run test:e2e -- tests/e2e/epic-7-11.spec.ts` failed 3/3 due login redirect mismatch (`Expected /dashboard/, received /login?`). Next action: fix/auth-stabilize e2e login/session bootstrap (and `allowedDevOrigins` dev config warning), then rerun streaming-focused e2e suite.

#### Questions — Unresolved
- [ ] None

#### Questions — Resolved
- [x] Phase-one scope includes full cross-family streaming (not phased pass-through).
- [x] Include `stream_options.include_usage` support.
- [x] Stream error handling: immediate stream error chunk/event then close.
- [x] Playground should expose streaming option.
- [x] When provider stream capability is disabled, drop stream flags and continue non-stream (no error throw).
- [x] Canonical config key naming → `supportsStreaming`.
- [x] "responses" clarification → requirement applies to Anthropic `/v1/messages` (global + path-lock parity), not `/responses`.
- [x] Immediate stream error payload contract:
  - OpenAI-compatible streams: `data: {"error":{"message":"<reason>","type":"api_error","code":"stream_error"}}` then close (no `[DONE]`).
  - Anthropic-compatible streams: `event: error` + `data: {"type":"error","error":{"type":"api_error","message":"<reason>"}}` then close.
- [x] Health systems requirement: health-check jobs and health endpoints must force non-stream behavior, dropping stream flags if present.

## Doc task validation status
- Last validated: 2026-05-12 18:02 UTC
- Result: Completed
