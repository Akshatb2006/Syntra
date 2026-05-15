export type DomainErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "DEPENDENCY_MISSING"
  | "TIMEOUT"
  | "MCP_TOOL_FAILED"
  | "LLM_FAILED"
  | "DISPATCH_FAILED"
  | "INTERNAL";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown> | undefined;
  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}
