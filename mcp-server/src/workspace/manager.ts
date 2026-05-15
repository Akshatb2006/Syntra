import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "../config.js";
import { AppError } from "../lib/errors.js";

mkdirSync(config.workspaceRoot, { recursive: true });

/**
 * Per-run workspace directories live under WORKSPACE_ROOT/{workspaceId}.
 * All filesystem and shell operations must be constrained to a workspace.
 */
export const workspaceManager = {
  pathFor(workspaceId: string): string {
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(workspaceId)) {
      throw new AppError("BAD_REQUEST", "Invalid workspaceId", {
        workspaceId,
      });
    }
    return resolve(config.workspaceRoot, workspaceId);
  },
  ensure(workspaceId: string): string {
    const p = this.pathFor(workspaceId);
    mkdirSync(p, { recursive: true });
    return p;
  },
  exists(workspaceId: string): boolean {
    return existsSync(this.pathFor(workspaceId));
  },
  /**
   * Resolve a user-supplied subpath against a workspace and prevent traversal.
   */
  safePath(workspaceId: string, userPath: string): string {
    const base = this.pathFor(workspaceId);
    if (!existsSync(base)) {
      throw new AppError("WORKSPACE_NOT_FOUND", "Workspace does not exist", {
        workspaceId,
      });
    }
    const candidate = resolve(base, userPath);
    if (
      candidate !== base &&
      !candidate.startsWith(base + (process.platform === "win32" ? "\\" : "/"))
    ) {
      throw new AppError("FORBIDDEN", "Path traversal not allowed", {
        userPath,
      });
    }
    return candidate;
  },
  /**
   * Resolve the repo subdirectory inside a workspace (where the clone lives).
   */
  repoPath(workspaceId: string): string {
    return join(this.pathFor(workspaceId), "repo");
  },
  destroy(workspaceId: string): void {
    const p = this.pathFor(workspaceId);
    if (existsSync(p)) rmSync(p, { recursive: true, force: true });
  },
};
