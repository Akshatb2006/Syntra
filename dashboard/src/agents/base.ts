import type { AgentName, AgentStep } from "@growth/shared/types";
import { newId } from "@/lib/id";
import type { TracerPort, SpanHandle } from "@/core/ports/tracer.port";
import type { StorePort } from "@/core/ports/store.port";
import type { EventBusPort } from "@/core/ports/eventbus.port";
import type { LlmPort, LlmTool, LlmCallInput, LlmContentBlock } from "@/core/ports/llm.port";
import { logger } from "@/lib/logger";

export interface AgentContext {
  runId: string;
  parentSpan: SpanHandle | null;
  tracer: TracerPort;
  store: StorePort;
  events: EventBusPort;
  llm: LlmPort;
}

export interface ToolDef<TInput, TOutput> {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  execute: (input: TInput) => Promise<TOutput>;
}

export abstract class BaseAgent<TInput, TOutput> {
  abstract readonly name: AgentName;
  abstract readonly title: string;
  abstract readonly model: string;

  abstract run(ctx: AgentContext, input: TInput): Promise<TOutput>;

  protected createStep(
    ctx: AgentContext,
    title: string,
    input: unknown,
    parentStepId: string | null = null,
  ): AgentStep {
    const step: AgentStep = {
      id: newId("step"),
      runId: ctx.runId,
      agent: this.name,
      parentStepId,
      title,
      status: "running",
      startedAt: Date.now(),
      endedAt: null,
      durationMs: null,
      input,
      output: null,
      error: null,
      metadata: {},
    };
    ctx.store.steps.insert(step);
    ctx.events.publish({
      type: "agent.step_started",
      runId: ctx.runId,
      agent: this.name,
      stepId: step.id,
      title,
      at: step.startedAt,
    });
    return step;
  }

  protected completeStep(
    ctx: AgentContext,
    step: AgentStep,
    output: unknown,
    metadata: Record<string, unknown> = {},
  ): void {
    const endedAt = Date.now();
    ctx.store.steps.update(step.id, {
      status: "completed",
      endedAt,
      durationMs: endedAt - step.startedAt,
      output,
      metadata,
    });
    ctx.events.publish({
      type: "agent.step_finished",
      runId: ctx.runId,
      stepId: step.id,
      status: "completed",
      at: endedAt,
    });
  }

  protected failStep(ctx: AgentContext, step: AgentStep, err: Error): void {
    const endedAt = Date.now();
    ctx.store.steps.update(step.id, {
      status: "failed",
      endedAt,
      durationMs: endedAt - step.startedAt,
      error: { message: err.message, stack: err.stack },
    });
    ctx.events.publish({
      type: "agent.step_finished",
      runId: ctx.runId,
      stepId: step.id,
      status: "failed",
      at: endedAt,
    });
  }

  /**
   * Standard tool-use loop. Calls the LLM with tools; for each tool_use block,
   * runs the local executor and feeds the result back. Returns the final
   * assistant text + accumulated tool calls. Each tool invocation gets its
   * own trace span under the agent's parent span.
   */
  protected async toolLoop(
    ctx: AgentContext,
    parentSpan: SpanHandle,
    input: {
      system: string;
      userPrompt: string;
      tools: Array<ToolDef<unknown, unknown>>;
      maxRounds?: number;
      maxTokens?: number;
    },
  ): Promise<{ text: string; toolCalls: Array<{ name: string; input: unknown; output: unknown }> }> {
    const tools: LlmTool[] = input.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }));
    const toolByName = new Map(input.tools.map((t) => [t.name, t]));
    const messages: LlmCallInput["messages"] = [
      { role: "user", content: input.userPrompt },
    ];
    const toolCalls: Array<{ name: string; input: unknown; output: unknown }> = [];
    const maxRounds = input.maxRounds ?? 10;
    let finalText = "";

    for (let round = 0; round < maxRounds; round++) {
      const llmSpan = ctx.tracer.startSpan({
        name: `llm.call:${this.name}:r${round}`,
        kind: "llm_call",
        runId: ctx.runId,
        parentSpanId: parentSpan.spanId,
        attributes: { model: this.model, round, traceId: parentSpan.traceId },
      });
      const resp = await ctx.llm
        .call({ model: this.model, system: input.system, messages, tools, maxTokens: input.maxTokens })
        .catch((err: unknown) => {
          llmSpan.end({
            status: "error",
            error: err instanceof Error ? err : new Error(String(err)),
          });
          throw err;
        });
      llmSpan.setAttribute("usage", resp.usage);
      llmSpan.setAttribute("stopReason", resp.stopReason);
      llmSpan.end({ status: "ok" });

      messages.push({ role: "assistant", content: resp.content });

      const textBlocks = resp.content.filter((b): b is Extract<LlmContentBlock, { type: "text" }> => b.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n");

      const toolUses = resp.content.filter(
        (b): b is Extract<LlmContentBlock, { type: "tool_use" }> => b.type === "tool_use",
      );
      if (toolUses.length === 0 || resp.stopReason === "end_turn") break;

      const toolResults: LlmContentBlock[] = [];
      for (const tu of toolUses) {
        const def = toolByName.get(tu.name);
        const toolSpan = ctx.tracer.startSpan({
          name: `tool.${tu.name}`,
          kind: "tool_call",
          runId: ctx.runId,
          parentSpanId: parentSpan.spanId,
          attributes: { tool: tu.name, traceId: parentSpan.traceId },
        });
        try {
          if (!def) throw new Error(`Unknown tool: ${tu.name}`);
          const output = await def.execute(tu.input);
          toolCalls.push({ name: tu.name, input: tu.input, output });
          toolSpan.end({ status: "ok", attributes: { ok: true } });
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify(output).slice(0, 40000),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          toolSpan.end({
            status: "error",
            error: err instanceof Error ? err : new Error(message),
          });
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Error: ${message}`,
            is_error: true,
          });
          logger.warn("tool_call_failed", { tool: tu.name, error: message });
        }
      }
      messages.push({ role: "user", content: toolResults });
    }
    return { text: finalText, toolCalls };
  }
}
