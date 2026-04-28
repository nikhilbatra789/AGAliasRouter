export type OpenAIMessageRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool' | 'function';

export type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | Record<string, unknown>;

export type OpenAIMessage = {
  role: OpenAIMessageRole;
  content?: string | OpenAIContentPart[] | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  function_call?: {
    name?: string;
    arguments?: string;
  };
};

export type OpenAIChatCompletionsRequest = {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: Array<{
    type?: string;
    function?: {
      name?: string;
      description?: string;
      parameters?: Record<string, unknown>;
      strict?: boolean;
    };
  }>;
  tool_choice?: 'none' | 'auto' | 'required' | { type?: string; function?: { name?: string } };
  response_format?: unknown;
  n?: number;
  [key: string]: unknown;
};

export type AnthropicTextContent = { type: 'text'; text: string };
export type AnthropicImageContent = {
  type: 'image';
  source: { type: 'url'; url: string } | { type: 'base64'; media_type: string; data: string };
};
export type AnthropicToolUseContent = { type: 'tool_use'; id?: string; name: string; input: Record<string, unknown> };
export type AnthropicToolResultContent = {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<AnthropicTextContent | AnthropicImageContent>;
  is_error?: boolean;
};

export type AnthropicContentBlock =
  | AnthropicTextContent
  | AnthropicImageContent
  | AnthropicToolUseContent
  | AnthropicToolResultContent
  | Record<string, unknown>;

export type AnthropicMessage = {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
};

export type AnthropicMessagesRequest = {
  model: string;
  messages: AnthropicMessage[];
  max_tokens: number;
  system?: string | AnthropicContentBlock[];
  temperature?: number;
  top_p?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: Array<{
    name: string;
    description?: string;
    input_schema?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  tool_choice?: {
    type?: 'auto' | 'any' | 'none' | 'tool';
    name?: string;
    [key: string]: unknown;
  };
  response_format?: unknown;
  [key: string]: unknown;
};
