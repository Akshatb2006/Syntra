import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const name = "rules";

export function register(server, config) {
  server.tool(
    "get_ground_rules",
    "Get the ground rules for working on ApartmentHub. Always call this at the start of a session.",
    {},
    async () => {
      try {
        const rulesPath = join(__dirname, "..", "RULES.md");
        const content = await readFile(rulesPath, "utf-8");
        return { content: [{ type: "text", text: content }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Could not load rules: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "get_user_info",
    "Get information about the currently authenticated user",
    {},
    async () => {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                username: config.username,
                project: "ApartmentHub",
                server: "apartmenthub-mcp",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
