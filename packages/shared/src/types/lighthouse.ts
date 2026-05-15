import type { LighthouseRunOutput } from "./mcp-tools.js";
import type { RunDelta } from "./run.js";

export type { LighthouseRunOutput };

export interface LighthouseCompare {
  baseline: LighthouseRunOutput;
  after: LighthouseRunOutput;
  delta: RunDelta;
  regressions: string[];
  improvements: string[];
}
