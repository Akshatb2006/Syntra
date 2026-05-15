export interface LlmTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface LlmMessage {
  role: "user" | "assistant";
  content: string | LlmContentBlock[];
}

export type LlmContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface LlmCallInput {
  model: string;
  system?: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmCallOutput {
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  content: LlmContentBlock[];
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmPort {
  call(input: LlmCallInput): Promise<LlmCallOutput>;
}
