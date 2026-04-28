# AG AliasRouter Internal API and Workflow Documentation

This document is the developer-facing API reference for AG AliasRouter. It covers internal admin APIs, customer-facing routing APIs, storage files, path locking, model mapping, health management, logs, translation, and operational workflows.

It is intended for internal automation and Identity AI workflows that need to inspect, configure, or drive AG AliasRouter programmatically.

## Base URL

Default local base URL:

```text
http://localhost:9001
```

Docker deployments may expose another host port:

```text
http://localhost:9100
```

Custom domains work the same way:

```text
https://aiprovider.example.com
```

## Authentication Model

AG AliasRouter has two authentication layers.

### Customer API Authentication

Customer-facing routes use the shared API key stored in `config/app_config.json`.

Accepted header styles:

```http
Authorization: Bearer sk-123456
```

```http
X-API-Key: sk-123456
```

The same shared API key is accepted by OpenAI-compatible and Anthropic-compatible customer endpoints.

### Admin API Authentication

Admin APIs under `/api/admin/*` use the admin session cookie:

```http
Cookie: aglias_session=active
```

The session is created by `POST /api/admin/session`. The default session lifetime is `3600` seconds. Admin username and password are stored in plain text in `config/app_config.json`.

## Response Conventions

Most admin APIs return a UI envelope:

```json
{
  "ok": true,
  "data": {}
}
```

Errors generally use:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error"
  }
}
```

Customer-facing OpenAI/Anthropic-compatible endpoints return provider-compatible response shapes rather than the admin envelope.

## Route Summary

### Customer-Facing Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/v1/models` | Global OpenAI-compatible model list |
| `POST` | `/v1/chat/completions` | Global OpenAI-compatible chat completions route |
| `POST` | `/v1/messages` | Global Anthropic-compatible messages route |
| `GET` | `/{providerAlias}/v1/models` | Path-locked provider model list |
| `POST` | `/{providerAlias}/v1/chat/completions` | Path-locked OpenAI-compatible chat route |
| `POST` | `/{providerAlias}/v1/messages` | Path-locked Anthropic-compatible messages route |
| `GET` | `/api/{providerAlias}/v1/models` | `/api` mirror for path-locked models |
| `POST` | `/api/{providerAlias}/v1/chat/completions` | `/api` mirror for path-locked chat completions |
| `POST` | `/api/{providerAlias}/v1/messages` | `/api` mirror for path-locked messages |

### Admin/Internal Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/session` | Read current admin session |
| `POST` | `/api/admin/session` | Login and create admin session |
| `DELETE` | `/api/admin/session` | Logout and clear admin session |
| `GET` | `/api/admin/config` | Read app configuration |
| `PUT` | `/api/admin/config` | Update app configuration and reload runtime timers |
| `GET` | `/api/admin/provider-pools` | Read provider pools with cached model lists attached |
| `PUT` | `/api/admin/provider-pools` | Save provider pools |
| `GET` | `/api/admin/provider-models?providerUuid=...` | Fetch models for one provider and update cache |
| `GET` | `/api/admin/model-mappings` | Read model mappings |
| `PUT` | `/api/admin/model-mappings` | Save model mappings |
| `POST` | `/api/admin/health-checks` | Check providers or provider/model rows |
| `GET` | `/api/admin/credential-files` | List config files and content |
| `DELETE` | `/api/admin/credential-files` | Delete a config file |
| `GET` | `/api/admin/dashboard` | Read dashboard metrics |
| `GET` | `/api/admin/logs/today` | Read today's structured logs |

## Customer-Facing APIs

### `GET /v1/models`

Returns an OpenAI-compatible model list across all enabled providers.

Authentication:

```http
Authorization: Bearer <sharedApiKey>
```

or:

```http
X-API-Key: <sharedApiKey>
```

Behavior:

- Reads `config/models_cache.json`.
- If an enabled provider is missing from cache, fetches that provider live.
- Updates `models_cache.json` before returning.
- Adds model mapping aliases from `config/model_mappings.json`.
- De-duplicates by model ID.
- Returns the stored model cache shape without extra response-time manipulation.

Example response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-5.5",
      "object": "model",
      "owned_by": "P1",
      "provider": "orbit"
    },
    {
      "id": "ai-gpt-5-2",
      "object": "model",
      "owned_by": "agliasrouter",
      "provider": "model-mapping"
    }
  ]
}
```

### `POST /v1/chat/completions`

Global OpenAI-compatible chat completions endpoint.

Request example:

```json
{
  "model": "ai-gpt-5-2",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ],
  "max_tokens": 1000
}
```

Behavior:

- Validates the shared API key.
- Rejects streaming requests.
- Rejects `temperature > 1`.
- Rejects `n > 1`.
- Resolves `model` through Model Mappings.
- Selects a provider row by `round_robin` or `ordered`.
- Uses healthy rows first and degraded rows as fallback.
- If the selected provider is OpenAI-compatible, forwards the request to the upstream OpenAI-compatible `/chat/completions`.
- If the selected provider is Anthropic-compatible, translates the OpenAI chat request to Anthropic messages, calls the upstream Anthropic-compatible `/messages`, and translates the response back to OpenAI chat completions.
- If a degraded row returns a successful response, the row is marked healthy.

### `POST /v1/messages`

Global Anthropic-compatible messages endpoint.

Request example:

```json
{
  "model": "claude-sonnet-alias",
  "max_tokens": 1000,
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
```

Behavior:

- Validates the shared API key.
- Rejects streaming requests.
- Rejects `temperature > 1`.
- Resolves `model` through Model Mappings.
- Selects a provider row by `round_robin` or `ordered`.
- Uses healthy rows first and degraded rows as fallback.
- If the selected provider is Anthropic-compatible, forwards the request to the upstream Anthropic-compatible `/messages`.
- If the selected provider is OpenAI-compatible, translates the Anthropic messages request to OpenAI chat completions, calls the upstream OpenAI-compatible `/chat/completions`, and translates the response back to Anthropic messages.
- If a degraded row returns a successful response, the row is marked healthy.

## Path Locking

Path locking selects one provider directly from the URL. It bypasses provider selection from Model Mappings, but the request body model still controls the upstream model name.

Supported provider aliases:

```text
openai-{uuid}
openai-{customName}
claude-{uuid}
claude-{customName}
```

The prefix chooses the provider family and provider identity:

- `openai-...` searches the `openai-custom` provider group.
- `claude-...` searches the `anthropic-custom` provider group.

The endpoint suffix chooses the client compatibility shape:

- `/v1/models`
- `/v1/chat/completions`
- `/v1/messages`

This means provider family and endpoint format are independent.

### Path Locking Examples

OpenAI-compatible provider, OpenAI-compatible endpoint:

```text
POST /openai-orbit/v1/chat/completions
```

No translation is required.

OpenAI-compatible provider, Anthropic-compatible endpoint:

```text
POST /openai-orbit/v1/messages
```

The request is Anthropic-compatible from the client perspective. Internally, it is translated to OpenAI chat completions and sent to the OpenAI-compatible provider.

Anthropic-compatible provider, Anthropic-compatible endpoint:

```text
POST /claude-main/v1/messages
```

No translation is required.

Anthropic-compatible provider, OpenAI-compatible endpoint:

```text
POST /claude-main/v1/chat/completions
```

The request is OpenAI-compatible from the client perspective. Internally, it is translated to Anthropic messages and sent to the Anthropic-compatible provider.

### Path-Locked Models

Path-locked model calls update the cache immediately:

```text
GET /openai-orbit/v1/models
GET /openai-{uuid}/v1/models
GET /claude-main/v1/models
GET /claude-{uuid}/v1/models
```

OpenAI-compatible providers return live `/models` results plus manual provider models. The combined list is saved to `config/models_cache.json`.

Anthropic-compatible providers return available provider models plus manual models. The combined list is saved to `config/models_cache.json`.

## Model Mapping Workflow

Model Mappings let consumers call stable public model aliases while AG AliasRouter selects an upstream provider/model row.

Stored file:

```text
config/model_mappings.json
```

Shape:

```json
{
  "mappings": [
    {
      "id": "mapping-id",
      "publicModelName": "ai-gpt-5-2",
      "strategy": "round_robin",
      "lastUsedIndex": 0,
      "rows": [
        {
          "id": "row-id",
          "providerFamily": "openai-custom",
          "providerUuid": "provider-uuid",
          "providerCustomName": "orbit",
          "upstreamModelName": "gpt-5.2",
          "health": "healthy",
          "lastHealthStatus": 200,
          "lastHealthResponse": "ok",
          "lastHealthCheckedAt": "2026-04-28T10:00:00.000Z"
        }
      ]
    }
  ]
}
```

### Selection Rules

When `/v1/chat/completions` or `/v1/messages` receives a global request:

1. The requested `model` is matched to `publicModelName`.
2. Rows with disabled providers, missing providers, missing upstream model names, or failed/unhealthy state are excluded.
3. Rows whose provider and row health are healthy or unknown are treated as healthy candidates.
4. Rows whose provider or row health is degraded are treated as fallback candidates.
5. Healthy candidates are preferred.
6. Degraded candidates are used only if no healthy candidates are available.
7. `round_robin` chooses the next available row after `lastUsedIndex` and persists the new index.
8. `ordered` chooses the first available row.

### Health Result Propagation

The Model Mapping UI deduplicates health checks by provider/model pair for card-level and all-model checks. If the same provider/model pair appears multiple times, one health check result is applied to all matching rows in the UI.

For saved rows, health results are persisted when the mapping is saved or when runtime jobs update saved mappings. For unsaved rows, health checks can update the UI state without creating a persisted row.

### Degraded Recovery

If a degraded mapping row is selected for a routed request and the upstream call succeeds, the row is marked healthy and the mapping runtime state is persisted.

## Provider Pools Workflow

Stored file:

```text
config/provider_pools.json
```

Provider groups:

```json
{
  "openai-custom": [],
  "anthropic-custom": []
}
```

Provider shape:

```json
{
  "uuid": "provider-uuid",
  "providerNumber": "P1",
  "name": "orbit",
  "customName": "orbit",
  "family": "openai-custom",
  "enabled": true,
  "health": "healthy",
  "usageCount": 0,
  "errorCount": 0,
  "lastUsed": "Never",
  "lastCheck": "2026-04-28T10:00:00.000Z",
  "lastError": "",
  "checkModelName": "gpt-5-mini",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-provider-key",
  "apiKeyMasked": "sk************abcd",
  "manualModels": ["manual-model-name"]
}
```

Important storage rules:

- Provider custom name is required.
- Provider custom name must be unique within the provider family.
- API keys are stored in plain text.
- Provider numbers are assigned automatically and stored in `app_config.json` through `providerCounter`.
- Provider runtime model lists are not stored in `provider_pools.json`.
- Manual model names are stored in `manualModels`.
- Fetched and combined model lists are stored in `models_cache.json`.

## Model Cache

Stored file:

```text
config/models_cache.json
```

Canonical model entry shape:

```json
{
  "id": "gpt-5.5",
  "object": "model",
  "owned_by": "P1",
  "provider": "orbit",
  "providerFamily": "openai-custom",
  "providerUuid": "provider-uuid",
  "providerCustomName": "orbit",
  "source": "api"
}
```

Manual model entry shape:

```json
{
  "id": "manual-model",
  "object": "model",
  "owned_by": "P1",
  "provider": "orbit",
  "providerFamily": "openai-custom",
  "providerUuid": "provider-uuid",
  "providerCustomName": "orbit",
  "source": "manual"
}
```

Cache update rules:

- `models_cache.json` is the only active model cache file.
- `models-cache.json` is deprecated and should not be created or used.
- Runtime refresh fetches enabled providers on the configured interval.
- Provider-locked model fetches update that provider's cache immediately.
- Global `/v1/models` fetches a provider live if that provider has no cache entries.
- OpenAI-compatible providers store live API models plus manual models.
- Manual models are de-duplicated against API models by provider UUID and model ID.
- Fetch-time manipulation happens before writing to cache; response-time code should read and return the cached shape.

## Health Management

Health is managed at two levels:

- Provider health.
- Model mapping row health.

### Provider Health

Provider health is stored in `provider_pools.json`.

Provider states:

| State | Meaning |
| --- | --- |
| `unknown` | No reliable health check result yet |
| `healthy` | Last check succeeded |
| `degraded` | Provider hit a transient failure, timeout, or 429 |
| `unhealthy` | Provider failed a non-transient check |
| `failed` | Provider accumulated repeated failures |

Provider check behavior:

1. Disabled providers return `unknown`.
2. Missing `checkModelName` returns `unhealthy`.
3. OpenAI-compatible providers are checked by calling `/chat/completions` with a tiny `Hi` request.
4. Anthropic-compatible providers are checked by calling `/messages` with a tiny `Hi` request.
5. `2xx` responses are healthy.
6. `429`, `408`, timeout, aborted request, DNS/network failure, or other transient fetch failure is degraded.
7. Authentication errors and non-transient provider failures are unhealthy.
8. Failure counts are stored on the provider.
9. Repeated failures can move a provider into failed state.
10. Health checks write log events.

### Model Mapping Row Health

Model row health is stored in `model_mappings.json`.

Model check behavior:

1. The provider must exist and be enabled.
2. Automatic model checks run only against healthy providers.
3. The row must have an upstream model name.
4. The system sends a tiny `Hi` request to the row's upstream model.
5. A non-empty successful response is healthy.
6. `429` and timeouts are degraded.
7. Other failures are unhealthy.
8. Transient restart-time failures are not allowed to permanently downgrade previously healthy rows on load.
9. Health checks write log events.

### Runtime Timers

Runtime timers are stored in `config/app_config.json` and can be edited from the Configuration screen.

| Config field | Default | Purpose |
| --- | ---: | --- |
| `cacheIntervalMinutes` | `15` | Refresh `models_cache.json` from providers |
| `degradedIntervalMinutes` | `15` | Re-check degraded providers |
| `unhealthyIntervalMinutes` | `60` | Re-check unhealthy or failed providers |
| `healthyModelsIntervalMinutes` | `360` | Re-check healthy model mapping rows |
| `unhealthyModelsIntervalMinutes` | `15` | Re-check unhealthy or failed model mapping rows |
| `retentionIntervalMinutes` | `60` | Prune log files older than retention |
| `healthCheckTimeoutSeconds` | `60` | Timeout for provider and model health-check calls |

On startup, runtime jobs immediately refresh the model cache, prune old logs, and check degraded/unhealthy providers. Automatic model mapping checks are interval-driven so a service restart does not immediately flip saved model row health because of transient startup/network issues.

## Logs

Log directory:

```text
logs/
```

Daily log files:

```text
logs/YYYY-MM-DD.log
```

Retention:

- Seven days by default.
- Pruning runs on `retentionIntervalMinutes`.

Log event sources:

- Customer route calls.
- Upstream provider calls.
- Provider health checks.
- Model health checks.
- Runtime errors.

Log line format:

```text
2026-04-28T10:00:00.000Z  INFO   route=/v1/models status=200 latencyMs=12
```

Secrets are masked before writing:

- `sk-*` tokens.
- `Authorization: Bearer ...`
- `x-api-key`.

Some route logs include URI-encoded structured fields for request headers, request body, and response body. The Real-time Logs UI can expand a row to display captured request headers, request body, and response body. The UI also supports mask/unmask display for these details.

## Translation

Translation is scoped to chat workloads:

- OpenAI `POST /v1/chat/completions`
- Anthropic `POST /v1/messages`

Other endpoints are not translated.

### When Translation Runs

Translation runs when the selected provider family does not match the endpoint compatibility shape.

| Endpoint | Selected provider | Behavior |
| --- | --- | --- |
| `/v1/chat/completions` | `openai-custom` | Direct OpenAI-compatible pass-through |
| `/v1/chat/completions` | `anthropic-custom` | OpenAI chat -> Anthropic messages -> OpenAI chat |
| `/v1/messages` | `anthropic-custom` | Direct Anthropic-compatible pass-through |
| `/v1/messages` | `openai-custom` | Anthropic messages -> OpenAI chat -> Anthropic messages |

The same rule applies to path-locked endpoints.

### OpenAI Chat Request to Anthropic Messages

The OpenAI-to-Anthropic adapter:

- Requires a `messages` array.
- Rejects `temperature > 1`.
- Rejects `n > 1`.
- Converts `system` and `developer` messages into Anthropic `system` text.
- Converts `user` and `assistant` turns to Anthropic message turns.
- Converts OpenAI text content to Anthropic text blocks.
- Converts OpenAI `image_url` blocks to Anthropic image blocks.
- Converts OpenAI assistant `tool_calls` and `function_call` to Anthropic `tool_use` blocks.
- Rejects invalid JSON in OpenAI tool call `function.arguments`.
- Converts OpenAI `tool` role messages to Anthropic `tool_result` blocks when `tool_call_id` is present.
- Supports OpenAI `function` role messages by converting them to user-side content.
- Maps `max_completion_tokens` or `max_tokens` to Anthropic `max_tokens`; if both are absent, the current implementation defaults to `1024`.
- Passes through `temperature`, `top_p`, stop sequences, tools, tool choice, stream flag, and `response_format` where present.

### Anthropic Messages Request to OpenAI Chat

The Anthropic-to-OpenAI adapter:

- Requires a `messages` array.
- Rejects `temperature > 1`.
- Converts Anthropic `system` to an OpenAI `system` message.
- Converts Anthropic user/assistant turns to OpenAI user/assistant messages.
- Converts Anthropic text blocks to OpenAI text content.
- Converts Anthropic `tool_use` blocks to OpenAI `tool_calls`.
- Converts Anthropic tools to OpenAI function tools.
- Maps Anthropic `tool_choice` to OpenAI `tool_choice`.
- Maps `max_tokens` to OpenAI `max_completion_tokens`.
- Passes through `temperature`, `top_p`, stop sequences, stream flag, and `response_format` where present.

### Anthropic Response to OpenAI Chat Completion

The adapter:

- Creates an OpenAI `chat.completion` object.
- Converts Anthropic content text to OpenAI assistant message content.
- Converts Anthropic `tool_use` to OpenAI `tool_calls`.
- Maps Anthropic `stop_reason` to OpenAI `finish_reason`.
- Maps Anthropic usage:
  - `input_tokens` -> `prompt_tokens`
  - `output_tokens` -> `completion_tokens`
  - sum -> `total_tokens`

### OpenAI Chat Completion Response to Anthropic Message

The adapter:

- Creates an Anthropic-compatible `message` object.
- Converts OpenAI assistant text to Anthropic text blocks.
- Converts OpenAI tool calls to Anthropic `tool_use` blocks.
- Maps OpenAI `finish_reason` to Anthropic `stop_reason`.
- Maps OpenAI usage:
  - `prompt_tokens` -> `input_tokens`
  - `completion_tokens` -> `output_tokens`

## Admin/Internal API Reference

### `POST /api/admin/session`

Creates an admin session.

Body:

```json
{
  "username": "admin@gmail.com",
  "password": "123456"
}
```

Success:

```json
{
  "ok": true,
  "data": {
    "username": "admin@gmail.com",
    "expiresAt": "2026-04-28T11:00:00.000Z"
  }
}
```

Side effects:

- Sets the `aglias_session` cookie.
- Uses plain-text credentials from `config/app_config.json`.

### `GET /api/admin/session`

Reads the current admin session.

Success:

```json
{
  "ok": true,
  "data": {
    "username": "admin@gmail.com",
    "expiresAt": "2026-04-28T11:00:00.000Z"
  }
}
```

Missing session returns `401`.

### `DELETE /api/admin/session`

Clears the admin session cookie.

Success:

```json
{
  "ok": true,
  "data": {
    "ok": true
  }
}
```

### `GET /api/admin/config`

Reads app configuration.

Success:

```json
{
  "ok": true,
  "data": {
    "adminUsername": "admin@gmail.com",
    "sharedApiKey": "sk-123456",
    "sharedApiKeyMasked": "sk********3456",
    "cacheIntervalMinutes": 15,
    "degradedIntervalMinutes": 15,
    "unhealthyIntervalMinutes": 60,
    "healthyModelsIntervalMinutes": 360,
    "unhealthyModelsIntervalMinutes": 15,
    "retentionIntervalMinutes": 60,
    "healthCheckTimeoutSeconds": 60
  }
}
```

Notes:

- The API returns the full shared API key because the Configuration screen supports reveal/hide behavior.
- The password is not returned by this endpoint.

### `PUT /api/admin/config`

Updates app configuration.

Body fields:

```json
{
  "adminUsername": "admin@gmail.com",
  "adminPassword": "new-password",
  "sharedApiKey": "sk-new-shared-key",
  "cacheIntervalMinutes": 15,
  "degradedIntervalMinutes": 15,
  "unhealthyIntervalMinutes": 60,
  "healthyModelsIntervalMinutes": 360,
  "unhealthyModelsIntervalMinutes": 15,
  "retentionIntervalMinutes": 60,
  "healthCheckTimeoutSeconds": 60
}
```

Validation:

- `adminUsername`, `adminPassword`, and `sharedApiKey` must be non-empty when provided.
- Timer fields must be positive integers in minutes.

Side effects:

- Saves `config/app_config.json`.
- Reloads runtime jobs so new timer values take effect.

### `GET /api/admin/provider-pools`

Reads provider pools.

Behavior:

- Reads `config/provider_pools.json`.
- Hydrates each provider with cached models from `config/models_cache.json`.
- Does not persist `models` back into `provider_pools.json`.

Success:

```json
{
  "ok": true,
  "data": [
    {
      "family": "openai-custom",
      "label": "OpenAI",
      "providers": [
        {
          "uuid": "provider-uuid",
          "providerNumber": "P1",
          "customName": "orbit",
          "family": "openai-custom",
          "enabled": true,
          "health": "healthy",
          "baseUrl": "https://api.openai.com/v1",
          "apiKey": "sk-provider-key",
          "apiKeyMasked": "sk********abcd",
          "manualModels": ["manual-model"],
          "models": []
        }
      ]
    }
  ]
}
```

### `PUT /api/admin/provider-pools`

Saves provider pools.

Body:

```json
[
  {
    "family": "openai-custom",
    "label": "OpenAI",
    "providers": []
  },
  {
    "family": "anthropic-custom",
    "label": "Anthropic",
    "providers": []
  }
]
```

Validation:

- Required groups are `openai-custom` and `anthropic-custom`.
- Provider custom names are required.
- Provider custom names must be unique inside each family.

Side effects:

- Assigns missing provider numbers.
- Updates `providerCounter` in `app_config.json`.
- Saves `provider_pools.json`.
- Returns hydrated pools.

### `GET /api/admin/provider-models?providerUuid={uuid}`

Fetches one provider's model list.

Behavior:

- Finds the provider by UUID.
- Calls the provider's model endpoint where supported.
- Appends manual models.
- Updates `config/models_cache.json`.
- Falls back to cached/manual models if the live call fails and cache exists.

Success:

```json
{
  "ok": true,
  "data": [
    {
      "id": "gpt-5.5",
      "object": "model",
      "owned_by": "P1",
      "provider": "orbit",
      "source": "api"
    }
  ]
}
```

### `GET /api/admin/model-mappings`

Reads all model mappings.

Success:

```json
{
  "ok": true,
  "data": [
    {
      "id": "mapping-id",
      "publicModelName": "ai-gpt-5-2",
      "strategy": "round_robin",
      "lastUsedIndex": 0,
      "rows": []
    }
  ]
}
```

### `PUT /api/admin/model-mappings`

Saves model mappings.

Body:

```json
[
  {
    "id": "mapping-id",
    "publicModelName": "ai-gpt-5-2",
    "strategy": "round_robin",
    "lastUsedIndex": 0,
    "rows": []
  }
]
```

Validation:

- `publicModelName` is required.
- `strategy` must be `round_robin` or `ordered`.

Side effects:

- Normalizes row health.
- Saves `config/model_mappings.json`.

### `POST /api/admin/health-checks`

Runs provider or model health checks.

Provider scope body:

```json
{
  "scope": "all"
}
```

Supported provider scopes:

- `all`
- `unhealthy`
- provider UUID
- provider custom name

Provider/model body:

```json
{
  "scope": "provider-uuid-or-custom-name",
  "modelName": "gpt-5.2"
}
```

Behavior:

- If `modelName` is present, checks that model on the scoped provider.
- If `modelName` is absent, checks providers in the scope.
- Writes health events to logs.

### `GET /api/admin/credential-files`

Lists config files and their contents.

Success:

```json
{
  "ok": true,
  "data": [
    {
      "name": "app_config.json",
      "path": "config/app_config.json",
      "content": "{...}",
      "added": "2026-04-28T09:00:00.000Z",
      "updated": "2026-04-28T10:00:00.000Z"
    }
  ]
}
```

### `DELETE /api/admin/credential-files`

Deletes a config file.

Body:

```json
{
  "name": "models_cache.json"
}
```

Notes:

- Deleting `app_config.json` causes it to be recreated with defaults on the next read.
- Deleting `provider_pools.json`, `model_mappings.json`, or `models_cache.json` causes those files to be recreated only when the relevant feature writes them again.

### `GET /api/admin/dashboard`

Reads dashboard metrics.

Behavior:

- Ensures runtime jobs are started.
- Returns live dashboard metrics such as provider counts, health counts, uptime, server time, platform, and routing path data.

### `GET /api/admin/logs/today`

Reads today's log file and returns parsed events in reverse chronological order.

Success:

```json
{
  "ok": true,
  "data": [
    {
      "t": "2026-04-28T10:00:00.000Z",
      "lvl": "INFO",
      "msg": "route=/v1/models status=200 latencyMs=12"
    }
  ]
}
```

## Storage and Startup Behavior

Config directory:

```text
config/
```

Log directory:

```text
logs/
```

Files:

| File | Recreated if missing | Invalid JSON behavior |
| --- | --- | --- |
| `app_config.json` | Yes, with defaults | Startup/read fails |
| `provider_pools.json` | Written by provider save flow | Startup/read fails |
| `model_mappings.json` | Written by mapping save flow | Startup/read fails |
| `models_cache.json` | Written by model cache flow | Treated as cache data; can be regenerated |

Default `app_config.json`:

```json
{
  "adminUsername": "admin@gmail.com",
  "adminPassword": "123456",
  "sharedApiKey": "sk-123456",
  "sessionLifetimeSeconds": 3600,
  "providerCounter": 0,
  "cacheIntervalMinutes": 15,
  "degradedIntervalMinutes": 15,
  "unhealthyIntervalMinutes": 60,
  "healthyModelsIntervalMinutes": 360,
  "unhealthyModelsIntervalMinutes": 15,
  "retentionIntervalMinutes": 60,
  "healthCheckTimeoutSeconds": 60
}
```

Security note: these files are intentionally plain text for MVP behavior. `config/` and `logs/` are gitignored.

## Identity AI Workflow Examples

### 1. Login

```bash
curl -i http://localhost:9001/api/admin/session \
  -H "Content-Type: application/json" \
  -d '{"username":"admin@gmail.com","password":"123456"}'
```

Store the returned `aglias_session` cookie for the following admin calls.

### 2. Read Current Providers

```bash
curl http://localhost:9001/api/admin/provider-pools \
  -H "Cookie: aglias_session=active"
```

### 3. Fetch Provider Models and Update Cache

```bash
curl "http://localhost:9001/api/admin/provider-models?providerUuid=provider-uuid" \
  -H "Cookie: aglias_session=active"
```

### 4. Save Model Mappings

```bash
curl -X PUT http://localhost:9001/api/admin/model-mappings \
  -H "Content-Type: application/json" \
  -H "Cookie: aglias_session=active" \
  -d '[{
    "id": "mapping-id",
    "publicModelName": "ai-gpt-5-2",
    "strategy": "round_robin",
    "lastUsedIndex": -1,
    "rows": [{
      "id": "row-id",
      "providerFamily": "openai-custom",
      "providerUuid": "provider-uuid",
      "providerCustomName": "orbit",
      "upstreamModelName": "gpt-5.2",
      "health": "unknown"
    }]
  }]'
```

### 5. Check Provider Health

```bash
curl -X POST http://localhost:9001/api/admin/health-checks \
  -H "Content-Type: application/json" \
  -H "Cookie: aglias_session=active" \
  -d '{"scope":"unhealthy"}'
```

### 6. Check One Provider Model

```bash
curl -X POST http://localhost:9001/api/admin/health-checks \
  -H "Content-Type: application/json" \
  -H "Cookie: aglias_session=active" \
  -d '{"scope":"provider-uuid","modelName":"gpt-5.2"}'
```

### 7. Call a Global OpenAI-Compatible Alias

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

### 8. Call a Path-Locked Provider

```bash
curl http://localhost:9001/openai-orbit/v1/models \
  -H "Authorization: Bearer sk-123456"
```

### 9. Read Logs

```bash
curl http://localhost:9001/api/admin/logs/today \
  -H "Cookie: aglias_session=active"
```

## Operational Notes

- Do not commit `config/` or `logs/`.
- Docker Compose runs the project, service, and container as `ag-aliasrouter`.
- Mount `config/` and `logs/` outside the container in Docker deployments.
- Use provider custom names that are stable, human-readable, and unique within each family.
- Keep health check models inexpensive and reliable.
- Use model aliases for consumer-facing contracts. Use path locking only when a workflow must force a specific provider.
- Use `round_robin` when distributing requests across equivalent provider rows.
- Use `ordered` when the first healthy row should be primary and later rows should be fallback.
- Treat degraded rows as usable fallback, not as first-choice capacity.
- Keep manual provider models for provider-specific models that do not appear in upstream `/models`.
