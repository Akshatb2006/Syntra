import type { PlatformEvent } from "@growth/shared/types";

export interface EventBusPort {
  publish(event: PlatformEvent): void;
  subscribe(listener: (event: PlatformEvent) => void): () => void;
  recent(limit?: number): PlatformEvent[];
}
