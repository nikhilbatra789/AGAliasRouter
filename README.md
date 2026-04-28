# AG AliasRouter

| Personal Use Disclaimer |
| --- |
| This project is for personal use only. Do not use this project to create, operate, or monetize a commercial system built from this middleware. If you have multiple unstable providers, you can use the Model Mapping feature to create a more stable stream for the same model by routing across different providers for yourself only. |

AG AliasRouter is a self-hosted AI provider middleware that exposes OpenAI-compatible and Anthropic-compatible endpoints while routing requests to configured upstream providers.

It is designed for teams that want one local or deployed API surface, one inbound API key, provider-level path locking, alias-based model routing, provider/model health tracking, plain-text configuration files, and an admin UI for day-to-day operations.

## Features

- OpenAI-compatible customer endpoints:
  - `GET /v1/models`
  - `POST /v1/chat/completions`
- Anthropic-compatible customer endpoints:
  - `POST /v1/messages`
- Provider path locking:
  - `/openai-{customName}/v1/models`
  - `/openai-{uuid}/v1/chat/completions`
  - `/claude-{customName}/v1/messages`
  - `/claude-{uuid}/v1/chat/completions`
- Cross-format translation for chat workloads:
  - OpenAI chat completions request/response <-> Anthropic messages request/response
  - Example: `/openai-orbit/v1/messages` locks to an OpenAI-compatible provider while accepting an Anthropic-compatible request.
  - Example: `/claude-main/v1/chat/completions` locks to an Anthropic-compatible provider while accepting an OpenAI-compatible request.
- Model alias routing:
  - Public model names map to one or more provider/model rows.
  - Supported strategies are `round_robin` and `ordered`.
  - Degraded routes are used as fallback when healthy routes are unavailable.
  - Failed, unhealthy, disabled, or missing rows are skipped.
- Provider pools:
  - OpenAI-compatible custom providers.
  - Anthropic-compatible custom providers.
  - Provider custom names are required.
  - Manual model lists can be added per provider.
  - Provider numbers such as `P1`, `P2`, and `P3` are assigned automatically.
- Model caching:
  - Model cache is stored in `config/models_cache.json`.
  - OpenAI-compatible providers use live `/models` results plus manual models.
  - Anthropic-compatible providers use configured/manual models and compatible `/models` results where available.
  - Global `GET /v1/models` returns cached provider models plus model mapping aliases.
  - If a provider is missing from cache during a global model request, the provider is fetched live and the cache is updated before returning the response.
  - Provider-locked model requests update that provider's cache immediately.
- Provider health management:
  - Provider health checks send a tiny `Hi` request to the configured health check model.
  - Provider health states include `healthy`, `degraded`, `unhealthy`, `failed`, and `unknown`.
  - Status `429` and timeouts are treated as degraded.
  - Authentication errors, 5xx errors, missing check models, and failed health checks are treated as unhealthy or failed depending on accumulated failures.
- Model mapping row health:
  - Model rows can be checked individually, per card, or globally.
  - Duplicate provider/model rows share health results across the model mapping UI.
  - Healthy model rows are rechecked on the configured healthy-model interval.
  - Unhealthy or failed model rows are rechecked on the configured unhealthy-model interval.
- Admin UI:
  - `/login`
  - `/dashboard`
  - `/configuration`
  - `/provider-pool`
  - `/model-mapping`
  - `/credential-files`
  - `/real-time-logs`
- Plain-text configuration:
  - `config/app_config.json`
  - `config/provider_pools.json`
  - `config/model_mappings.json`
  - `config/models_cache.json`
- Credential file management:
  - View config files from the UI.
  - Download individual files.
  - Download all config files.
  - Delete config files from the UI where allowed by the admin screen.
- Real-time logs:
  - Live route, upstream, health, and error events.
  - Mask/unmask support in the UI for captured request/response details.
  - Daily log files in `logs/`.
  - Seven-day retention by default.
  - Download today's log from the UI.
- Runtime timer configuration:
  - Model cache refresh interval.
  - Degraded provider check interval.
  - Unhealthy/failed provider check interval.
  - Healthy model row check interval.
  - Unhealthy/failed model row check interval.
  - Log retention pruning interval.
- Docker deployment:
  - `Dockerfile`
  - `docker-compose.yml`
  - External host-mounted `config/` and `logs/` folders.

## Quick Start

Install dependencies and run the local development server:

```bash
npm install
npm run dev
```

Open the admin UI:

```text
http://localhost:9001
```

Default admin credentials are created on first launch if `config/app_config.json` does not exist:

```text
Username: admin@gmail.com
Password: 123456
Shared API key: sk-123456
```

These values are stored in plain text in `config/app_config.json` and should be changed from the Configuration screen.

## Production With Docker Compose

Start the service:

```bash
docker compose up --build -d
```

For a clean install from the current source code without using Docker build cache:

```bash
docker compose build --no-cache
docker compose up -d
```

Default app URL:

```text
http://localhost:9001
```

`docker-compose.yml` supports host path overrides:

- `CONFIG_DIR` defaults to `./config`
- `LOGS_DIR` defaults to `./logs`
- `PORT` defaults to `9001`

Override them inline:

```bash
CONFIG_DIR=/absolute/path/config LOGS_DIR=/absolute/path/logs PORT=9100 docker compose up --build -d
```

Or create a `.env` file next to `docker-compose.yml`:

```env
CONFIG_DIR=/absolute/path/config
LOGS_DIR=/absolute/path/logs
PORT=9100
```

Then start normally:

```bash
docker compose up --build -d
```

With these overrides, the app is available at `http://localhost:9100`, while config files are stored in `/absolute/path/config` and logs are stored in `/absolute/path/logs` on the host.

The Compose project, service, and container are named `ag-aliasrouter`. The container always listens on port `9001` internally. `PORT` controls the host port mapped to the container.

## Customer API Authentication

Customer-facing API requests use one shared API key from `config/app_config.json`.

OpenAI-style clients can use:

```http
Authorization: Bearer sk-123456
```

Anthropic-style clients can use:

```http
X-API-Key: sk-123456
```

Both header styles are accepted by the customer-facing endpoints.

## Customer Endpoints

### Global OpenAI Models

```bash
curl http://localhost:9001/v1/models \
  -H "Authorization: Bearer sk-123456"
```

The response is OpenAI-compatible:

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-5.5",
      "object": "model",
      "owned_by": "P1",
      "provider": "orbit"
    }
  ]
}
```

`owned_by` is the provider number assigned by the system. `provider` is the provider custom name.

### Global OpenAI Chat Completions

```bash
curl http://localhost:9001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-123456" \
  -d '{
    "model": "ai-gpt-5-2",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 1000
  }'
```

The `model` field is resolved through Model Mappings. The selected provider/model row may be OpenAI-compatible or Anthropic-compatible. If an Anthropic-compatible row is selected, AG AliasRouter translates the OpenAI chat request to Anthropic messages and translates the response back to OpenAI chat completions.

### Global Anthropic Messages

```bash
curl http://localhost:9001/v1/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk-123456" \
  -d '{
    "model": "claude-sonnet-alias",
    "max_tokens": 1000,
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

The `model` field is resolved through Model Mappings. If an OpenAI-compatible row is selected, AG AliasRouter translates the Anthropic messages request to OpenAI chat completions and translates the response back to Anthropic messages.

## Path Locking

Path locking selects a specific provider before the request is routed.

The path prefix selects the provider:

- `openai-{uuid}`
- `openai-{customName}`
- `claude-{uuid}`
- `claude-{customName}`

The endpoint path selects the client compatibility format:

- `/v1/models`
- `/v1/chat/completions`
- `/v1/messages`

Examples:

```text
/openai-orbit/v1/models
```

Fetches models from the OpenAI-compatible provider named `orbit`.

```text
/openai-orbit/v1/messages
```

Uses the OpenAI-compatible provider named `orbit`, but accepts and returns Anthropic-compatible messages payloads through translation.

```text
/claude-main/v1/chat/completions
```

Uses the Anthropic-compatible provider named `main`, but accepts and returns OpenAI-compatible chat completions payloads through translation.

`/api/{providerAlias}/v1/...` path-locked mirrors are also available for compatibility with clients that prefer an `/api` prefix.

## Model Mappings

Model mappings create public model aliases that consumers call from global routes.

Each mapping contains:

- A public model name, such as `ai-gpt-5-2`.
- A routing strategy, either `round_robin` or `ordered`.
- One or more rows pointing to a provider and upstream model.

Routing behavior:

- `round_robin` rotates across available rows and persists `lastUsedIndex`.
- `ordered` chooses the first available row.
- Healthy rows are preferred.
- Degraded rows are used as fallback.
- Unhealthy, failed, disabled, or incomplete rows are skipped.
- If a degraded row succeeds during a routed request, it is marked healthy.

Model mapping configuration is stored in:

```text
config/model_mappings.json
```

## Provider Pools

Providers are grouped by family:

- `openai-custom` maps to OpenAI-compatible providers.
- `anthropic-custom` maps to Anthropic-compatible providers.

Each provider stores:

- UUID
- Provider number
- Custom name
- Base URL
- API key
- Enabled/disabled state
- Health state
- Health check model
- Manual model names
- Last check/error metadata

Provider pool configuration is stored in:

```text
config/provider_pools.json
```

Provider model lists are not persisted inside `provider_pools.json`. Runtime and fetched models are stored in `config/models_cache.json`.

## Health Management

Provider health checks use the provider's configured health check model and send a tiny `Hi` request.

Provider check outcomes:

- `2xx`: healthy
- `429`: degraded
- timeout or transient network failure: degraded
- authentication failure: unhealthy
- missing health check model: unhealthy
- repeated failures: failed

Model row health checks use the selected provider and upstream model with the same tiny request pattern. A non-empty `2xx` response is healthy. `429` and timeout are degraded. Other failures are unhealthy.

Runtime jobs are configured in the Configuration screen and saved to `config/app_config.json`:

| Timer | Default | Purpose |
| --- | ---: | --- |
| Model cache refresh | 15 minutes | Refresh `models_cache.json` from providers |
| Degraded provider checks | 15 minutes | Re-check degraded providers |
| Unhealthy provider checks | 60 minutes | Re-check unhealthy or failed providers |
| Healthy model checks | 360 minutes | Re-check healthy model mapping rows |
| Unhealthy model checks | 15 minutes | Re-check unhealthy or failed model mapping rows |
| Log retention pruning | 60 minutes | Remove logs older than seven days |
| Health check timeout | 60 seconds | Timeout for provider and model health-check calls |

## Translation Scope

AG AliasRouter translates only the chat workloads in MVP:

- OpenAI `POST /v1/chat/completions` <-> Anthropic `POST /v1/messages`

Translation is used when the selected provider family does not match the endpoint compatibility shape.

Current constraints:

- Streaming is not supported.
- `temperature` must be less than or equal to `1`.
- OpenAI `n` must be less than or equal to `1`.
- OpenAI tool call `function.arguments` must be valid JSON when translating to Anthropic.
- OpenAI `function` role messages are supported.
- `response_format` is passed through by the translation layer.

## Logs

Logs are written to:

```text
logs/YYYY-MM-DD.log
```

Logs include routing, upstream, health, and error events. Request headers, request bodies, and response bodies can be captured where the route supplies them. Secrets such as API keys are masked before writing logs.

The Real-time Logs screen supports:

- Live updates.
- Pause/resume.
- Clear.
- Download today's log.
- Mask/unmask display for captured request/response details.

Logs are pruned after seven days by default.

## Configuration Files

Runtime files are stored in plain text under `config/`:

| File | Purpose |
| --- | --- |
| `app_config.json` | Admin credentials, shared API key, provider counter, runtime timers |
| `provider_pools.json` | OpenAI-compatible and Anthropic-compatible provider definitions |
| `model_mappings.json` | Public model aliases and route rows |
| `models_cache.json` | Cached provider model list and manual model additions |

If `app_config.json` does not exist, it is recreated with defaults. If `app_config.json`, `provider_pools.json`, or `model_mappings.json` exists but contains invalid JSON or an invalid shape, startup fails with an error.

`config/` and `logs/` are intentionally ignored by Git.

## Admin UI

Use the admin UI to manage the system:

- Dashboard: health, provider counts, active routing paths, and usage examples.
- Configuration: admin login, shared API key, and runtime timers.
- Provider Pools: add/edit providers, manual models, health checks, copy provider aliases.
- Model Mappings: create aliases, select provider/model rows, check row/card/all health.
- Credential Files: view and download config files.
- Real-time Logs: inspect live logs and download today's log.

Admin sessions are stored in a browser cookie and expire after the configured session lifetime. The default session lifetime is one hour.

## Development

Run locally:

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Start production build:

```bash
npm run start
```

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE).
