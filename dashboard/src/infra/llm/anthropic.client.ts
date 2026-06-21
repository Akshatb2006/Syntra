import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmPort,
  LlmCallInput,
  LlmCallOutput,
  LlmContentBlock,
} from "@/core/ports/llm.port";
import { env } from "@/lib/env";
import { DomainError } from "@/core/errors";

/**
 * Per-instance Anthropic client. Constructor accepts an optional API key —
 * pipelines construct a client per-run using the end user's key from the
 * /connect form, falling back to the platform's ANTHROPIC_API_KEY env.
 */
export class AnthropicClient implements LlmPort {
  private client: Anthropic | null = null;
  private readonly apiKey: string | null;

  constructor(apiKey?: string | null) {
    this.apiKey = apiKey ?? env.anthropicKey;
  }

  private getClient(): Anthropic {
    if (!this.apiKey)
      throw new DomainError(
        "DEPENDENCY_MISSING",
        "Anthropic API key missing — supply one via /connect or set ANTHROPIC_API_KEY in the dashboard env",
      );
    // Hand the SDK Node's native `fetch`. The SDK (0.32.1) otherwise uses a
    // bundled node-fetch shim that throws "Premature close" on Node 20+/22;
    // global undici fetch works reliably.
    if (!this.client)
      this.client = new Anthropic({ apiKey: this.apiKey, fetch: globalThis.fetch });
    return this.client;
  }

  async call(input: LlmCallInput): Promise<LlmCallOutput> {
    const c = this.getClient();
    const messages = input.messages.map((m) => {
      if (typeof m.content === "string")
        return {
          role: m.role,
          content: [{ type: "text", text: m.content }] as const,
        };
      return { role: m.role, content: m.content };
    });
    // Don't pass `temperature` unless the caller explicitly set it — it's
    // deprecated on newer models (e.g. Opus 4.7 returns 400 if supplied).
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: input.model,
      max_tokens: input.maxTokens ?? 4096,
      system: input.system,
      messages: messages as unknown as Anthropic.MessageParam[],
      tools: input.tools as unknown as Anthropic.Tool[] | undefined,
    };
    if (input.temperature !== undefined) {
      params.temperature = input.temperature;
    }
    const resp = await c.messages.create(params);
    const stopReason = (resp.stop_reason ?? "end_turn") as LlmCallOutput["stopReason"];
    const content: LlmContentBlock[] = resp.content.flatMap((b): LlmContentBlock[] => {
      // The SDK's content union grows over time (text, tool_use, thinking,
      // server_tool_use, …). Translate only what the agent loop cares about;
      // silently drop the rest.
      const block = b as {
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
      };
      if (block.type === "text") return [{ type: "text", text: block.text ?? "" }];
      if (block.type === "tool_use" && block.id && block.name) {
        return [
          { type: "tool_use", id: block.id, name: block.name, input: block.input },
        ];
      }
      return [];
    });
    return {
      stopReason,
      content,
      usage: {
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
      },
    };
  }
}
