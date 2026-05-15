import { EventEmitter } from "node:events";
import type { PlatformEvent } from "@growth/shared/types";
import { logger } from "../lib/logger.js";

/**
 * In-memory pub-sub for platform events. Process-local; sufficient for the
 * hackathon where MCP and webhooks run on one server. Dashboard subscribes
 * via /events SSE.
 */
class EventBus {
  private emitter = new EventEmitter();
  private buffer: PlatformEvent[] = [];
  private readonly BUFFER_SIZE = 500;

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish(event: PlatformEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.BUFFER_SIZE) {
      this.buffer.splice(0, this.buffer.length - this.BUFFER_SIZE);
    }
    this.emitter.emit("event", event);
    logger.debug("event_published", { type: event.type });
  }

  subscribe(listener: (event: PlatformEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  /** Recent events (for late SSE subscribers who want catch-up). */
  recent(limit = 50): PlatformEvent[] {
    return this.buffer.slice(-limit);
  }
}

export const eventBus = new EventBus();
