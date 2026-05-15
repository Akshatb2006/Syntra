import { z } from "zod";
import { spawn } from "node:child_process";
import { workspaceManager } from "../workspace/manager.js";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";

const ALLOWED_COMMANDS = new Set([
  "npm",
  "pnpm",
  "yarn",
  "npx",
  "node",
  "git",
  "gh",
  "ls",
  "cat",
  "echo",
]);

function isCommandAllowed(cmd: string): boolean {
  return ALLOWED_COMMANDS.has(cmd);
}

export const shellPlugin: Plugin = {
  name: "shell",
  register(server) {
    server.tool(
      MCP_TOOLS.SHELL_RUN,
      "Run an allowlisted command inside a workspace's repo. Returns exit code, stdout, stderr.",
      {
        workspaceId: z.string().min(6),
        command: z.string().min(1),
        args: z.array(z.string()).default([]),
        timeoutMs: z.number().int().positive().max(10 * 60 * 1000).default(60_000),
      },
      async ({ workspaceId, command, args, timeoutMs }) => {
        if (!isCommandAllowed(command)) {
          return {
            content: [
              {
                type: "text",
                text: `Error: command "${command}" not in allowlist (${Array.from(ALLOWED_COMMANDS).join(", ")})`,
              },
            ],
            isError: true,
          };
        }
        const cwd = workspaceManager.repoPath(workspaceId);
        const started = Date.now();
        return await new Promise((resolve) => {
          const child = spawn(command, args, {
            cwd,
            env: { ...process.env, CI: "1" },
          });
          let stdout = "";
          let stderr = "";
          let killed = false;
          const timer = setTimeout(() => {
            killed = true;
            child.kill("SIGKILL");
          }, timeoutMs);
          child.stdout.on("data", (b) => {
            stdout += b.toString();
          });
          child.stderr.on("data", (b) => {
            stderr += b.toString();
          });
          child.on("close", (code) => {
            clearTimeout(timer);
            const exitCode = killed ? -1 : (code ?? -1);
            resolve({
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      exitCode,
                      stdout: stdout.slice(-50000),
                      stderr: stderr.slice(-20000),
                      durationMs: Date.now() - started,
                      killedByTimeout: killed,
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: exitCode !== 0,
            });
          });
          child.on("error", (err) => {
            clearTimeout(timer);
            resolve({
              content: [{ type: "text", text: `Error: ${err.message}` }],
              isError: true,
            });
          });
        });
      },
    );
  },
};
