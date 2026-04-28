# OpenAI Chat Completions and Anthropic Messages Translation

This document describes how to translate between the OpenAI-compatible Chat Completions API shape and the Anthropic-compatible Messages API shape using the two local specs:

- `OpenAI-ChatCompletions.md`
- `Anthropic-Messages.md`

The primary implementation assumption is:

1. Accept an OpenAI-compatible `POST /v1/chat/completions` request.
2. Convert it into an Anthropic-compatible `POST /v1/messages` request.
3. Convert Anthropic's response or stream back into an OpenAI-compatible Chat Completions response.

Reverse translation is included where it is straightforward, but some features are one-way or need product decisions.

## Endpoint Shape

| Concept | OpenAI Chat Completions | Anthropic Messages | Translation |
| --- | --- | --- | --- |
| Endpoint | `POST /v1/chat/completions` | `POST /v1/messages` | Gateway route decides provider direction. |
| Main input | `messages` | `messages` plus top-level `system` | OpenAI instruction roles must move to Anthropic `system`. |
| Output | `chat.completion` with `choices[]` | `message` with `content[]` | Wrap Anthropic single message as `choices[0]`. |
| Streaming | `chat.completion.chunk` SSE payloads | Messages SSE events | Requires event adapter and state accumulator. |

## Request Handling Pipeline

For an OpenAI-compatible request backed by Anthropic, the gateway should process the request in this order:

1. Parse and validate the OpenAI request body.
2. Resolve the model alias to an Anthropic model ID.
3. Choose output-token cap from `max_completion_tokens`, then `max_tokens`, then a gateway default.
4. Validate sampling fields, especially `temperature`, `top_p`, and any nonstandard `top_k`.
5. Split instruction messages from conversational messages.
6. Normalize messages into Anthropic's allowed roles and content blocks.
7. Convert tools, tool choices, and prior tool results.
8. Drop, reject, or preserve unsupported provider-specific fields according to strict/compatibility mode.
9. Send `POST /v1/messages` with `stream` matching the client request.
10. Convert the provider response into the client's expected response shape.

Validation should happen before making the provider request. If a field cannot be mapped without changing behavior, prefer a clear compatibility error over silently sending a different request.

## Request Translation: OpenAI to Anthropic

### Core Field Map

| OpenAI field | Anthropic field | Handling |
| --- | --- | --- |
| `model` | `model` | Requires an explicit model mapping table if OpenAI model names are accepted but Anthropic is the backend. If model is already an Anthropic model ID, pass through. |
| `messages` | `system`, `messages` | Split `system` and `developer` into top-level `system`; convert only `user` and `assistant` turns into Anthropic `messages`; convert tool traffic into Anthropic content blocks. |
| `max_completion_tokens` | `max_tokens` | Preferred OpenAI source. Use as Anthropic `max_tokens`. |
| `max_tokens` | `max_tokens` | Fallback when `max_completion_tokens` is absent. OpenAI marks this deprecated, but Anthropic requires `max_tokens`. |
| `temperature` | `temperature` | OpenAI allows `0..2`; Anthropic allows `0..1`. Values inside `0..1` pass through. Values above `1` need a policy decision. |
| `top_p` | `top_p` | Direct pass-through. Both APIs use nucleus sampling. |
| `top_k` | `top_k` | Anthropic supports it; OpenAI Chat Completions does not define it. Only map if the OpenAI-compatible facade intentionally accepts a nonstandard `top_k` extension. |
| `stop` | `stop_sequences` | Convert string to one-element array. Preserve array order. OpenAI allows up to 4 stop sequences. |
| `stream` | `stream` | Direct pass-through. Response events require shape conversion. |
| `tools` | `tools` | OpenAI function tools can map to Anthropic client tools. See tool section. |
| `tool_choice` | `tool_choice` | Maps mostly, but names and parallel tool flags need normalization. |
| `parallel_tool_calls` | `tool_choice.disable_parallel_tool_use` | If `parallel_tool_calls: false`, set `disable_parallel_tool_use: true` in Anthropic `tool_choice`. If true or omitted, leave false/omitted. |
| `response_format` | `output_config.format` | `json_schema` can map. `json_object` has no exact schema unless we synthesize one or add instructions. |
| `metadata.user`, `user`, `safety_identifier` | `metadata.user_id` | Prefer `metadata.user_id` if already present; otherwise map stable user identifier if policy allows. |
| `service_tier` | `service_tier` | Partial only. Anthropic supports `auto` and `standard_only`; OpenAI has `auto`, `default`, `flex`, `scale`, `priority`. |

### Max Tokens

Recommended precedence:

1. If `max_completion_tokens` is present, use it.
2. Else if `max_tokens` is present, use it.
3. Else apply a gateway default, because Anthropic requires `max_tokens`.

Conflict rule:

- If both `max_completion_tokens` and `max_tokens` are present and differ, prefer `max_completion_tokens` and optionally log a compatibility warning.

Open question:

- What default should the gateway use when OpenAI clients omit both fields? Anthropic requires `max_tokens`, while OpenAI does not require either field.

### Temperature

Direct mapping is safe only for `0 <= temperature <= 1`.

OpenAI allows values up to `2`; Anthropic allows values up to `1`.

Policy options for OpenAI values above `1`:

1. Strict: reject with a compatibility error.
2. Lenient clamp: send `1`.
3. Rescale: send `temperature / 2`.

Recommendation: use strict rejection for correctness, unless the router is explicitly designed to maximize compatibility over parameter fidelity. Silent rescaling changes sampling behavior in a way that is hard to debug.

### Top P

`top_p` maps directly both ways.

Both specs describe it as nucleus sampling. Preserve the value as provided, subject to provider validation.

### Top K

Anthropic supports `top_k`; OpenAI Chat Completions does not list `top_k`.

Handling options:

1. Accept a nonstandard OpenAI-compatible extension field `top_k` and pass it to Anthropic.
2. Ignore `top_k` when received on OpenAI-compatible requests.
3. Reject `top_k` as unsupported by OpenAI Chat Completions.

Recommendation: if this project is a provider router rather than a strict OpenAI clone, accept `top_k` as an extension and document it. If strict OpenAI compatibility matters, reject it.

## Message Translation

This is the most important part of the adapter.

### Role Mapping

| OpenAI role | Anthropic representation | Notes |
| --- | --- | --- |
| `system` | Top-level `system` | Anthropic has no `system` role inside `messages`. |
| `developer` | Top-level `system` | OpenAI says newer models use `developer` instead of `system`; Anthropic only has top-level `system`. |
| `user` | `messages[].role = "user"` | Text and supported content blocks map. |
| `assistant` | `messages[].role = "assistant"` | Text maps; tool calls map to `tool_use` content blocks. |
| `tool` | Usually a `user` message containing `tool_result` blocks | Anthropic receives tool results as user-side content blocks. |
| `function` | Usually a `user` message containing `tool_result` blocks | Deprecated OpenAI role. Requires a tool-use ID policy. |

### System and Developer Messages

OpenAI can include multiple `system` and `developer` messages and they can appear in the message array. Anthropic has one top-level `system` field.

Recommended handling:

1. Extract all `system` and `developer` messages in original order.
2. Convert each content item to text.
3. Join them into Anthropic `system`.
4. Preserve role labels when joining, for example:

```text
[system]
You are a helpful assistant.

[developer]
Use short answers.
```

Open question:

- Should role labels be injected into the system text, or should the text be concatenated without labels? Labels preserve intent but add prompt text that the original client did not send verbatim.

### Text Content

String content maps directly.

OpenAI:

```json
{"role": "user", "content": "Hello"}
```

Anthropic:

```json
{"role": "user", "content": "Hello"}
```

For array content blocks:

| OpenAI content block | Anthropic content block | Handling |
| --- | --- | --- |
| `{ "type": "text", "text": "..." }` | `{ "type": "text", "text": "..." }` | Direct. |
| `{ "type": "image_url", "image_url": { "url": "https://..." } }` | `{ "type": "image", "source": { "type": "url", "url": "https://..." } }` | Direct for URL images. |
| Base64 image URL/data URL | `{ "type": "image", "source": { "type": "base64", "media_type": "...", "data": "..." } }` | Requires parsing media type and data. |
| `{ "type": "input_audio", ... }` | No direct common mapping in Messages spec excerpt | Reject or route only to models/providers that support audio. |
| `{ "type": "file", ... }` | Anthropic `document` or `container_upload`, depending on file type and source | Needs file handling policy. |

### Alternating Turns

Anthropic says consecutive `user` or `assistant` turns are combined into a single turn. OpenAI permits sequences that may not alternate cleanly.

Recommended gateway behavior:

- Normalize consecutive messages of the same Anthropic role before sending.
- Preserve content block order when combining.
- Do not merge across tool-use boundaries if doing so would make tool results ambiguous.

### Assistant Prefill

Both APIs can represent a partially completed assistant message, but Anthropic explicitly says if the final input message is `assistant`, the response continues immediately from that content.

Mapping:

- OpenAI final `assistant` message with text content can be sent as final Anthropic `assistant` message.
- When converting the Anthropic response back to OpenAI, return only the newly generated continuation in `choices[0].message.content`.

Open question:

- Should the gateway expose Anthropic-style assistant prefill behavior to OpenAI clients, or should it reject final assistant messages unless they are historical assistant turns?

### Tool Calls and Tool Results

OpenAI function tool definition:

```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get weather",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  }
}
```

Anthropic client tool definition:

```json
{
  "name": "get_weather",
  "description": "Get weather",
  "input_schema": {
    "type": "object",
    "properties": {}
  }
}
```

Mapping rules:

| OpenAI | Anthropic | Notes |
| --- | --- | --- |
| `tools[].type = "function"` | client tool object | Drop wrapper; move `function.parameters` to `input_schema`. |
| `tools[].function.name` | `tools[].name` | Direct. |
| `tools[].function.description` | `tools[].description` | Direct. |
| `tools[].function.parameters` | `tools[].input_schema` | Direct if it is an object schema. |
| `tools[].function.strict` | `tools[].strict` | Direct if supported. |
| `tool_choice: "none"` | `{ "type": "none" }` | Direct. |
| `tool_choice: "auto"` | `{ "type": "auto" }` | Direct. |
| `tool_choice: "required"` | `{ "type": "any" }` | Anthropic "any" means use any available tool. |
| named OpenAI tool choice | `{ "type": "tool", "name": "..." }` | Direct by tool name. |

Assistant tool calls:

| OpenAI assistant message | Anthropic assistant content |
| --- | --- |
| `tool_calls[].id` | `tool_use.id` |
| `tool_calls[].function.name` | `tool_use.name` |
| `tool_calls[].function.arguments` | `tool_use.input` |

Important conflict:

- OpenAI tool call arguments are a JSON string.
- Anthropic tool input is an object/map.

Recommended handling:

- Parse OpenAI `function.arguments` as JSON.
- If parsing fails, reject the request or wrap as a best-effort object such as `{ "_raw": "..." }`.

Open question:

- Should invalid OpenAI tool-call JSON be rejected, or should the gateway preserve it in a synthetic object?

Tool result mapping:

OpenAI:

```json
{
  "role": "tool",
  "tool_call_id": "call_123",
  "content": "result"
}
```

Anthropic:

```json
{
  "role": "user",
  "content": [
    {
      "type": "tool_result",
      "tool_use_id": "call_123",
      "content": "result"
    }
  ]
}
```

Deprecated OpenAI `function` messages are harder because they include `name` but no `tool_call_id`. A gateway must either synthesize IDs from prior assistant function calls or reject standalone function-result messages.

## Anthropic Request to OpenAI

Reverse request translation is possible for the common path:

| Anthropic field | OpenAI field | Handling |
| --- | --- | --- |
| `model` | `model` | Requires model map if OpenAI backend is used. |
| `system` | First `system` or `developer` message | Prefer `developer` for newer OpenAI models if the facade controls model family; otherwise use `system`. |
| `messages[].role = "user"` | `messages[].role = "user"` | Convert content blocks. |
| `messages[].role = "assistant"` | `messages[].role = "assistant"` | Convert text and `tool_use` blocks to `tool_calls`. |
| `max_tokens` | `max_completion_tokens` | Prefer OpenAI's newer field. |
| `temperature` | `temperature` | Direct because Anthropic range is inside OpenAI range. |
| `top_p` | `top_p` | Direct. |
| `top_k` | No OpenAI equivalent | Drop or reject. |
| `stop_sequences` | `stop` | Direct. |
| `output_config.format` | `response_format` | JSON schema can map to `response_format.type = "json_schema"`. |

## Response Translation: Anthropic to OpenAI

### Non-Streaming Response

Anthropic returns one `message` object. OpenAI returns a `chat.completion` object with `choices[]`.

Anthropic:

```json
{
  "id": "msg_123",
  "type": "message",
  "role": "assistant",
  "content": [{ "type": "text", "text": "Hello" }],
  "model": "claude-sonnet-4-5",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 5
  }
}
```

OpenAI-compatible:

```json
{
  "id": "msg_123",
  "object": "chat.completion",
  "created": 1760000000,
  "model": "claude-sonnet-4-5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello"
      },
      "finish_reason": "stop",
      "logprobs": null
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

### Content Blocks

| Anthropic content block | OpenAI response field | Handling |
| --- | --- | --- |
| `text` | `message.content` | Concatenate text blocks in order. |
| `tool_use` | `message.tool_calls[]` | Convert input object to JSON string in `function.arguments`. |
| `server_tool_use` | No exact common OpenAI Chat equivalent | Either expose as tool call if modeled as a function, or omit/store in provider metadata. |
| `thinking` | No OpenAI Chat equivalent | Omit by default; optionally expose through nonstandard metadata. |
| `redacted_thinking` | No OpenAI Chat equivalent | Omit by default. |
| citations | `annotations` only for URL citations | Anthropic has broader citation types than OpenAI Chat response annotations. |

If Anthropic returns both text and `tool_use` blocks, the OpenAI response can include both `message.content` and `message.tool_calls`.

### Stop Reason Mapping

| Anthropic `stop_reason` | OpenAI `finish_reason` | Notes |
| --- | --- | --- |
| `end_turn` | `stop` | Natural completion. |
| `stop_sequence` | `stop` | OpenAI does not distinguish natural stop from stop sequence in `finish_reason`. |
| `max_tokens` | `length` | Direct semantic equivalent. |
| `tool_use` | `tool_calls` | Direct semantic equivalent. |
| `refusal` | `content_filter` or `stop` with refusal content | Needs policy. |
| `pause_turn` | No exact equivalent | Needs policy. Could map to `length`, `stop`, or a nonstandard finish reason. |

Open questions:

- Should Anthropic `refusal` map to OpenAI `content_filter`, or should refusal text be returned as normal assistant content with `finish_reason: "stop"`?
- How should `pause_turn` be represented for OpenAI clients? It has no exact Chat Completions finish reason.

### Usage Mapping

Anthropic usage fields:

- `input_tokens`
- `cache_creation_input_tokens`
- `cache_read_input_tokens`
- `output_tokens`

OpenAI usage fields:

- `prompt_tokens`
- `completion_tokens`
- `total_tokens`
- optional details such as cached tokens

Recommended mapping:

```text
prompt_tokens = input_tokens + cache_creation_input_tokens + cache_read_input_tokens
completion_tokens = output_tokens
total_tokens = prompt_tokens + completion_tokens
prompt_tokens_details.cached_tokens = cache_read_input_tokens
```

Notes:

- Anthropic warns that usage counts may not match the visible request/response exactly because the API transforms and parses messages internally.
- OpenAI response fields such as `created`, `object`, `system_fingerprint`, and `service_tier` may need to be synthesized or omitted.

## Response Translation: OpenAI to Anthropic

For reverse compatibility, map the first OpenAI choice to an Anthropic `Message`.

| OpenAI field | Anthropic field | Handling |
| --- | --- | --- |
| `id` | `id` | Direct. |
| `choices[0].message.role` | `role` | Always `assistant`. |
| `choices[0].message.content` | `content[].text` | Convert to one `text` block. |
| `choices[0].message.tool_calls` | `content[].tool_use` | Parse `function.arguments` JSON into `input`. |
| `choices[0].finish_reason` | `stop_reason` | Use stop mapping below. |
| `usage.prompt_tokens` | `usage.input_tokens` | Approximate. |
| `usage.completion_tokens` | `usage.output_tokens` | Approximate. |

OpenAI finish reason to Anthropic stop reason:

| OpenAI `finish_reason` | Anthropic `stop_reason` |
| --- | --- |
| `stop` | `end_turn` unless a known stop sequence matched |
| `length` | `max_tokens` |
| `tool_calls` | `tool_use` |
| `function_call` | `tool_use` |
| `content_filter` | `refusal` |

If OpenAI returns multiple choices, Anthropic has no equivalent single response shape. The gateway must either return only `choices[0]`, make multiple provider responses, or reject requests with `n > 1`.

## Response Handling Pipeline

For an Anthropic response returned to an OpenAI-compatible client:

1. Start a `chat.completion` response object.
2. Use Anthropic `id` as the OpenAI `id`, or synthesize one if absent.
3. Synthesize `created` as the gateway response timestamp.
4. Use the provider model or original requested model based on the compatibility policy.
5. Convert Anthropic `content[]` into `choices[0].message`.
6. Convert Anthropic `stop_reason` into `choices[0].finish_reason`.
7. Convert Anthropic `usage` into OpenAI `usage`.
8. Preserve provider-only fields only in gateway metadata if clients are expected to consume them.

For strict OpenAI compatibility, do not add unknown top-level fields unless the client contract allows extensions.

## Streaming Translation

### OpenAI Streaming Shape

OpenAI streams `chat.completion.chunk` objects. Each chunk contains `choices[].delta`.

Common sequence:

1. First chunk: `delta.role = "assistant"` and maybe empty content.
2. Content chunks: `delta.content = "..."`.
3. Final chunk: empty `delta` and non-null `finish_reason`.
4. Optional usage chunk if `stream_options.include_usage` is true.
5. Terminal `data: [DONE]`.

### Anthropic Streaming Shape

The local Anthropic endpoint spec only states that `stream: true` uses server-sent events and that `stop_reason` is null in the `message_start` event and non-null otherwise. It does not include the full streaming event schema.

The expected Messages streaming model usually has event types like:

- `message_start`
- `content_block_start`
- `content_block_delta`
- `content_block_stop`
- `message_delta`
- `message_stop`
- `ping`
- `error`

This should be verified against the exact Anthropic streaming spec before implementation.

### Anthropic Stream to OpenAI Stream

The adapter should maintain state:

- `id`
- `model`
- `created` timestamp
- current content block index
- accumulated text
- accumulated tool-call input JSON
- final stop reason
- usage

Suggested event conversion:

| Anthropic event | OpenAI chunk |
| --- | --- |
| `message_start` | Emit chunk with `delta.role = "assistant"`, `finish_reason = null`. |
| `content_block_start` for `text` | If the block has initial text, emit it as `delta.content`; otherwise no-op. |
| `content_block_delta` with text delta | Emit `delta.content`. |
| `content_block_start` for `tool_use` | Emit `delta.tool_calls[index].id`, `type = "function"`, and `function.name`. |
| Tool input JSON delta | Emit `delta.tool_calls[index].function.arguments` partial string. |
| `content_block_stop` | Usually no OpenAI chunk required unless finalizing a tool call. |
| `message_delta` with usage | Store usage; optionally emit final usage chunk later. |
| `message_delta` with stop reason | Store mapped `finish_reason`. |
| `message_stop` | Emit final chunk with empty `delta` and mapped `finish_reason`, then `data: [DONE]`. |
| `ping` | Ignore. |
| `error` | Convert to the gateway's OpenAI-compatible streaming error shape. |

If `stream_options.include_usage` is true:

- Emit an additional chunk before `[DONE]` with `choices: []` and `usage` populated, matching OpenAI's documented behavior.
- Other chunks can include `usage: null`.

Open question:

- What exact error event shape should the gateway stream to OpenAI clients when Anthropic emits an SSE `error` event?

### OpenAI Stream to Anthropic Stream

Reverse streaming is harder because OpenAI deltas are flatter, while Anthropic streams message and content-block lifecycle events.

Suggested conversion:

1. On first OpenAI chunk, emit Anthropic `message_start`.
2. On first text delta, emit `content_block_start` for a text block.
3. Emit each OpenAI `delta.content` as a text `content_block_delta`.
4. On tool-call delta, emit or continue a `tool_use` content block.
5. On final OpenAI `finish_reason`, emit `content_block_stop`, `message_delta` with mapped `stop_reason`, then `message_stop`.

This reverse path needs careful testing because OpenAI tool-call arguments stream as JSON string fragments, while Anthropic tool input may stream as structured or partial JSON deltas.

## Common Conflicts and Decisions Needed

| Area | Conflict | Decision needed |
| --- | --- | --- |
| Required `max_tokens` | Anthropic requires `max_tokens`; OpenAI request may omit token caps. | Choose default max output tokens. |
| Temperature range | OpenAI supports `0..2`; Anthropic supports `0..1`. | Reject, clamp, or rescale values above `1`. |
| `top_k` | Anthropic supports it; OpenAI Chat spec does not. | Treat as extension, reject, or ignore. |
| Instruction roles | OpenAI has `system` and `developer`; Anthropic has top-level `system`. | Decide whether to label joined instruction blocks. |
| Message names | OpenAI messages may have `name`; Anthropic messages do not. | Drop names or inject into text. |
| Consecutive roles | Anthropic combines consecutive same-role turns. | Normalize manually or rely on provider behavior. |
| Tool call arguments | OpenAI stores arguments as string; Anthropic stores input as object. | Decide behavior for invalid JSON strings. |
| Deprecated `function` role | OpenAI function result lacks `tool_call_id`; Anthropic requires `tool_use_id`. | Synthesize IDs from history or reject. |
| `n` choices | OpenAI can request multiple choices; Anthropic response is single-message. | Reject `n > 1`, make multiple calls, or return one choice. |
| Refusals | Anthropic has `stop_reason: "refusal"` and `stop_details`; OpenAI has `content_filter` and `refusal` fields. | Decide whether refusal is content, finish reason, or both. |
| `pause_turn` | Anthropic has no OpenAI finish-reason equivalent. | Choose a compatibility representation. |
| Streaming errors | Stream error semantics differ. | Define one OpenAI-compatible error SSE format. |
| Usage details | Token accounting semantics differ. | Use approximate mapping and document it. |
| Model IDs | Model names are provider-specific. | Maintain explicit model alias map. |

## Lower-Priority or Advanced Fields

These fields are not part of the common translation path and should be handled after the core request/response/stream adapter is stable.

### OpenAI Fields With No Direct Anthropic Equivalent

- `audio`
- `modalities`
- `frequency_penalty`
- `presence_penalty`
- `logit_bias`
- `logprobs`
- `top_logprobs`
- `prediction`
- `seed`
- `store`
- `prompt_cache_key`
- `prompt_cache_retention`
- `verbosity`
- `web_search_options` in OpenAI's specific shape

Possible handling:

- Reject in strict mode.
- Ignore in compatibility mode with warnings.
- Map only when there is an explicit Anthropic equivalent or server-tool configuration.

### Anthropic Fields With No Direct OpenAI Chat Equivalent

- `cache_control`
- `container`
- `inference_geo`
- `thinking`
- `top_k`
- broad `citations` model
- `server_tool_use`
- built-in server tools such as code execution, web fetch, memory, and tool search
- `pause_turn`
- `stop_details`

Possible handling:

- Expose through provider-specific extension fields.
- Drop in strict OpenAI-compatible output.
- Add gateway metadata outside the OpenAI response if clients can consume it.

### Structured Output

OpenAI:

- `response_format: { "type": "json_schema", "json_schema": { ... } }`
- `response_format: { "type": "json_object" }`
- `response_format: { "type": "text" }`

Anthropic:

- `output_config.format: { "type": "json_schema", "schema": ... }`

Recommended mapping:

- OpenAI `json_schema.schema` -> Anthropic `output_config.format.schema`.
- OpenAI `json_schema.name`, `description`, and `strict` have no exact Anthropic fields in the local spec excerpt. Preserve only if supported by implementation extensions.
- OpenAI `json_object` should either be rejected or converted into a weak schema `{ "type": "object" }` plus a system instruction.

Open question:

- Should `json_object` be supported by synthetic prompting, or should only `json_schema` be supported?

## Recommended Strict Compatibility Defaults

For a predictable first implementation:

1. Require or default `max_tokens`.
2. Reject `temperature > 1` for Anthropic-backed calls.
3. Pass through `top_p`.
4. Accept `top_k` only as a documented nonstandard extension.
5. Reject `n > 1`.
6. Map `system` and `developer` messages into top-level Anthropic `system`.
7. Support text, image URL/base64, function tools, tool calls, and tool results.
8. Reject audio/file/custom-tool cases until explicit policies are defined.
9. Convert Anthropic text and tool-use responses into one OpenAI choice.
10. Implement streaming with an accumulator and emit OpenAI-style chunks plus `[DONE]`.
