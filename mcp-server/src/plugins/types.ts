import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface PluginContext {
  username: string;
}

export interface Plugin {
  name: string;
  register: (server: McpServer, ctx: PluginContext) => void;
}
