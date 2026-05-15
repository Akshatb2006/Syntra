import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const name = "supabase";

// Blocked SQL keywords for safety
const BLOCKED_KEYWORDS = ["DROP", "TRUNCATE", "DELETE", "ALTER", "CREATE", "INSERT", "UPDATE", "GRANT", "REVOKE"];

function isReadOnly(sql) {
  const upper = sql.trim().toUpperCase();
  // Must start with a safe keyword
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH") && !upper.startsWith("EXPLAIN")) {
    return false;
  }
  // Check for dangerous keywords (naive but effective for guard rails)
  for (const keyword of BLOCKED_KEYWORDS) {
    // Match keyword as a whole word (not inside identifiers)
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(sql)) return false;
  }
  return true;
}

export function register(server, config) {
  const hasSupabaseCreds = config.supabaseUrl && config.supabaseServiceRoleKey;
  const supabase = hasSupabaseCreds
    ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey)
    : null;
  const projectRef = config.supabaseProjectRef;
  const accessToken = config.supabaseAccessToken;

  if (!hasSupabaseCreds) {
    console.warn("Supabase plugin: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — API tools disabled, filesystem tools still available");
  }

  // --- Supabase API tools (require credentials) ---
  if (hasSupabaseCreds) {

  server.tool(
    "supabase_query",
    "Execute a read-only SQL query against the Supabase PostgreSQL database. Only SELECT/WITH/EXPLAIN statements are allowed. Dangerous keywords (DROP, DELETE, ALTER, etc.) are blocked.",
    { sql: z.string().describe("SQL SELECT query to execute") },
    async ({ sql }) => {
      if (!isReadOnly(sql)) {
        return {
          content: [{ type: "text", text: "Error: Only read-only queries (SELECT, WITH, EXPLAIN) are allowed. Dangerous keywords like DROP, DELETE, ALTER, INSERT, UPDATE are blocked." }],
          isError: true,
        };
      }

      // Prefer Management API if configured
      if (projectRef && accessToken) {
        try {
          const response = await fetch(
            `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ query: sql }),
            }
          );

          if (!response.ok) {
            const errBody = await response.text();
            return {
              content: [{ type: "text", text: `Management API error (${response.status}): ${errBody}` }],
              isError: true,
            };
          }

          const result = await response.json();
          // Truncate large results
          const text = JSON.stringify(result, null, 2);
          const truncated = text.length > 15000 ? text.slice(0, 15000) + "\n... (truncated)" : text;
          return { content: [{ type: "text", text: truncated }] };
        } catch (err) {
          return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
        }
      }

      // Fallback: no Management API configured
      return {
        content: [{
          type: "text",
          text: "Direct SQL not available — SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are not configured. Use the query_table tool to query individual tables via the REST API, or configure the Management API credentials.",
        }],
        isError: true,
      };
    }
  );

  // --- List tables via Management API or fallback ---
  server.tool(
    "list_tables",
    "List all tables in the public schema with their row counts",
    {},
    async () => {
      // Try Management API first
      if (projectRef && accessToken) {
        try {
          const response = await fetch(
            `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: `SELECT schemaname, tablename, 
                        (SELECT count(*) FROM pg_catalog.pg_class c2 
                         JOIN pg_catalog.pg_namespace n ON n.oid = c2.relnamespace 
                         WHERE c2.relname = t.tablename AND n.nspname = t.schemaname) as est_rows
                        FROM pg_catalog.pg_tables t WHERE schemaname = 'public' ORDER BY tablename`,
              }),
            }
          );
          if (response.ok) {
            const result = await response.json();
            return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
          }
        } catch {
          // Fall through to fallback
        }
      }

      // Fallback: known tables from CLAUDE.md
      return {
        content: [{
          type: "text",
          text: "Known tables (from project docs): dossiers, personen, documenten, apartments, accounts, verification_codes, real_estate_agents, tenants, crm_agents, rental_leads\n\nFor live table listing, configure SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF.",
        }],
      };
    }
  );

  // --- Query table via REST API ---
  server.tool(
    "query_table",
    "Query a specific Supabase table with optional filters via the REST API",
    {
      table: z.string().describe("Table name"),
      select: z.string().default("*").describe("Columns to select (supports Supabase select syntax)"),
      filters: z
        .array(
          z.object({
            column: z.string(),
            operator: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is"]),
            value: z.string(),
          })
        )
        .default([])
        .describe("Filters to apply"),
      limit: z.number().default(25).describe("Max rows to return"),
      order_by: z.string().optional().describe("Column to order by (prefix with - for descending)"),
    },
    async ({ table, select, filters, limit, order_by }) => {
      try {
        let query = supabase.from(table).select(select).limit(limit);
        for (const f of filters) {
          query = query[f.operator](f.column, f.value);
        }
        if (order_by) {
          const desc = order_by.startsWith("-");
          const col = desc ? order_by.slice(1) : order_by;
          query = query.order(col, { ascending: !desc });
        }
        const { data, error } = await query;
        if (error) {
          return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  } // end hasSupabaseCreds

  // --- Filesystem tools (always available) ---

  // --- List Edge Functions ---
  server.tool(
    "list_edge_functions",
    "List all Supabase Edge Functions by scanning the supabase/functions directory",
    {},
    async () => {
      try {
        const { readdir } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const functionsDir = join(config.repoPath, "supabase", "functions");
        const entries = await readdir(functionsDir, { withFileTypes: true });
        const functions = entries
          .filter((e) => e.isDirectory() && !e.name.startsWith("_") && !e.name.startsWith("."))
          .map((e) => e.name);
        return { content: [{ type: "text", text: functions.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  // --- Migration History ---
  server.tool(
    "get_migration_history",
    "List all Supabase migration files",
    {},
    async () => {
      try {
        const { readdir } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const migrationsDir = join(config.repoPath, "supabase", "migrations");
        const files = await readdir(migrationsDir);
        const migrations = files.filter((f) => f.endsWith(".sql")).sort();
        return { content: [{ type: "text", text: migrations.join("\n") }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
