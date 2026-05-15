import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import { z } from "zod";

export const name = "codebase";

export function register(server, config) {
  const repoPath = resolve(config.repoPath);

  // Ensure path is within repo (prevent traversal)
  function safePath(userPath) {
    const resolved = resolve(repoPath, userPath);
    if (!resolved.startsWith(repoPath)) {
      throw new Error("Path traversal not allowed");
    }
    return resolved;
  }

  server.tool(
    "read_file",
    "Read the contents of a file in the ApartmentHub codebase",
    { path: z.string().describe("Relative path from project root") },
    async ({ path }) => {
      try {
        const content = await readFile(safePath(path), "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "list_directory",
    "List files and directories at a given path",
    { path: z.string().default(".").describe("Relative path from project root") },
    async ({ path }) => {
      try {
        const dirPath = safePath(path);
        const entries = await readdir(dirPath, { withFileTypes: true });
        const listing = entries
          .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .sort();
        return { content: [{ type: "text", text: listing.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "search_code",
    "Search for a pattern in the codebase (basic grep-like)",
    {
      pattern: z.string().describe("Text or regex pattern to search for"),
      glob: z.string().default("**/*.{js,jsx,ts,tsx,json,md,sql}").describe("File glob to search within"),
    },
    async ({ pattern, glob: globPattern }) => {
      try {
        const { glob } = await import("glob");
        const files = await glob(globPattern, {
          cwd: repoPath,
          ignore: ["**/node_modules/**", "**/.next/**", "**/dist/**"],
          nodir: true,
        });

        const regex = new RegExp(pattern, "gi");
        const results = [];

        for (const file of files.slice(0, 500)) {
          try {
            const content = await readFile(join(repoPath, file), "utf-8");
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (regex.test(lines[i])) {
                results.push(`${file}:${i + 1}: ${lines[i].trim()}`);
                regex.lastIndex = 0;
              }
            }
          } catch {
            // Skip unreadable files
          }
          if (results.length >= 50) break;
        }

        return {
          content: [
            {
              type: "text",
              text: results.length > 0 ? results.join("\n") : "No matches found",
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "sync_repo",
    "Pull latest changes from the remote repository (git pull origin main)",
    {},
    async () => {
      try {
        const output = execSync("git pull origin main --ff-only", {
          cwd: repoPath,
          timeout: 30000,
          encoding: "utf-8",
        });
        return { content: [{ type: "text", text: output.trim() }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "get_project_structure",
    "Get a tree view of the project's top-level structure",
    {},
    async () => {
      try {
        const entries = await readdir(repoPath, { withFileTypes: true });
        const lines = [];
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          if (entry.isDirectory()) {
            const sub = await readdir(join(repoPath, entry.name), { withFileTypes: true }).catch(() => []);
            const subNames = sub
              .filter((s) => !s.name.startsWith(".") && s.name !== "node_modules")
              .map((s) => (s.isDirectory() ? `${s.name}/` : s.name))
              .sort()
              .slice(0, 20);
            lines.push(`${entry.name}/`);
            for (const s of subNames) lines.push(`  ${s}`);
            if (sub.length > 20) lines.push(`  ... (${sub.length - 20} more)`);
          } else {
            lines.push(entry.name);
          }
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
