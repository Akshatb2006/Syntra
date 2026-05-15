import { z } from "zod";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import { mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { workspaceManager } from "../workspace/manager.js";
import type { Plugin } from "./types.js";
import { MCP_TOOLS } from "@growth/shared/constants";

const IGNORE_NAMES = new Set([".git", "node_modules", ".next", "dist", "build"]);
const MAX_BYTES = 2 * 1024 * 1024;

export const fsPlugin: Plugin = {
  name: "fs",
  register(server) {
    server.tool(
      MCP_TOOLS.FS_READ,
      "Read a file inside a workspace's repo (path relative to repo/).",
      {
        workspaceId: z.string().min(6),
        path: z.string().min(1),
      },
      async ({ workspaceId, path }) => {
        try {
          const full = workspaceManager.safePath(
            workspaceId,
            join("repo", path),
          );
          const s = await stat(full);
          if (s.size > MAX_BYTES) {
            return {
              content: [
                {
                  type: "text",
                  text: `Error: file too large (${s.size} bytes > ${MAX_BYTES})`,
                },
              ],
              isError: true,
            };
          }
          const content = await readFile(full, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ path, bytes: s.size, content }, null, 2),
              },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    server.tool(
      MCP_TOOLS.FS_WRITE,
      "Write a file inside a workspace's repo. Creates parent directories.",
      {
        workspaceId: z.string().min(6),
        path: z.string().min(1),
        content: z.string(),
      },
      async ({ workspaceId, path, content }) => {
        try {
          const full = workspaceManager.safePath(
            workspaceId,
            join("repo", path),
          );
          await mkdir(dirname(full), { recursive: true });
          await writeFile(full, content, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ path, bytes: Buffer.byteLength(content) }),
              },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );

    server.tool(
      MCP_TOOLS.FS_LIST,
      "List directory entries inside a workspace's repo.",
      {
        workspaceId: z.string().min(6),
        path: z.string().default("."),
      },
      async ({ workspaceId, path }) => {
        try {
          const full = workspaceManager.safePath(
            workspaceId,
            join("repo", path),
          );
          const dirEntries = await readdir(full, { withFileTypes: true });
          const entries = await Promise.all(
            dirEntries
              .filter((e) => !IGNORE_NAMES.has(e.name) && !e.name.startsWith("."))
              .map(async (e) => {
                const s = await stat(join(full, e.name)).catch(() => null);
                return {
                  name: e.name,
                  isDirectory: e.isDirectory(),
                  size: s?.size ?? 0,
                };
              }),
          );
          entries.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ path, entries }, null, 2),
              },
            ],
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text", text: `Error: ${msg}` }],
            isError: true,
          };
        }
      },
    );
  },
};

export { relative as _r };
