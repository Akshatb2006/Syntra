import { EventEmitter } from "node:events";
import type { PlatformEvent } from "@growth/shared/types";
import type { EventBusPort } from "@/core/ports/eventbus.port";

/**
 * In-process pub-sub. Server-side only — survives the lifetime of the Node
 * process (and Next.js dev server). API routes publish/subscribe via the
 * singleton getter to keep the bus shared across module instances.
 */
class LocalEventBus implements EventBusPort {
  private emitter = new EventEmitter();
  private buffer: PlatformEvent[] = [];
  private readonly capacity = 500;
  constructor() {
    this.emitter.setMaxListeners(200);
  }
  publish(event: PlatformEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.capacity)
      this.buffer.splice(0, this.buffer.length - this.capacity);
    this.emitter.emit("event", event);
  }
  subscribe(listener: (event: PlatformEvent) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }
  recent(limit = 50): PlatformEvent[] {
    return this.buffer.slice(-limit);
  }
}

// Use globalThis so Next.js dev HMR doesn't create multiple instances.
const KEY = "__growth_eventbus__";
const g = globalThis as unknown as Record<string, EventBusPort | undefined>;
if (!g[KEY]) g[KEY] = new LocalEventBus();

export const eventBus: EventBusPort = g[KEY]!;
