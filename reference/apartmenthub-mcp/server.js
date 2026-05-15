import "dotenv/config";
import express from "express";
import { appendFileSync, mkdirSync, createWriteStream } from "node:fs";
import { join } from "node:path";
import { execSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { loadPlugins } from "./plugin-loader.js";

const PORT = process.env.PORT || 3100;
const LOG_DIR = process.env.LOG_DIR || join(process.cwd(), "logs");
const DISPATCH_LOG_DIR = process.env.DISPATCH_LOG_DIR || join(LOG_DIR, "dispatch");
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const DISPATCH_BRANCH = process.env.DISPATCH_BRANCH || "seo";
mkdirSync(LOG_DIR, { recursive: true });
mkdirSync(DISPATCH_LOG_DIR, { recursive: true });

// Parse VALID_TOKENS env: "tok_akshat:akshat,tok_david:david"
const tokenMap = new Map();
for (const pair of (process.env.VALID_TOKENS || "").split(",")) {
  const [token, username] = pair.split(":");
  if (token && username) tokenMap.set(token.trim(), username.trim());
}

if (tokenMap.size === 0) {
  console.error("VALID_TOKENS env var is empty or missing. No users will be able to authenticate.");
}

// Shared config passed to plugins
const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseProjectRef: process.env.SUPABASE_PROJECT_REF,
  supabaseAccessToken: process.env.SUPABASE_ACCESS_TOKEN,
  githubToken: process.env.GITHUB_TOKEN,
  githubRepo: process.env.GITHUB_REPO,
  repoPath: process.env.REPO_PATH || process.cwd(),
};

// --- Logging ---
function log(event, data = {}) {
  const entry = { ts: new Date().toISOString(), event, ...data };
  const line = JSON.stringify(entry);
  console.log(line);
  try {
    const dateStr = new Date().toISOString().slice(0, 10);
    appendFileSync(join(LOG_DIR, `${dateStr}.log`), line + "\n");
  } catch {
    // Don't crash if log write fails
  }
}

// --- Repo auto-sync ---
const SYNC_INTERVAL = parseInt(process.env.REPO_SYNC_INTERVAL_MS || "300000", 10); // 5min default

function syncRepo() {
  try {
    const result = execSync("git pull origin main --ff-only", {
      cwd: config.repoPath,
      timeout: 30000,
      encoding: "utf-8",
    });
    const trimmed = result.trim();
    if (!trimmed.includes("Already up to date")) {
      log("repo_sync", { status: "updated", output: trimmed });
    }
  } catch (err) {
    log("repo_sync_error", { error: err.message });
  }
}

if (process.env.REPO_AUTO_SYNC !== "false") {
  syncRepo(); // sync once at startup
  setInterval(syncRepo, SYNC_INTERVAL);
  log("repo_sync_enabled", { intervalMs: SYNC_INTERVAL });
}

// Pre-load plugins once
const plugins = await loadPlugins();
log("server_start", { plugins: plugins.map((p) => p.name), users: tokenMap.size });

const app = express();
app.use(express.json());

// Auth middleware for /mcp
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    log("auth_rejected", { reason: "missing_token", ip: req.ip, method: req.method });
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = auth.slice(7);
  const username = tokenMap.get(token);
  if (!username) {
    log("auth_rejected", { reason: "invalid_token", ip: req.ip, method: req.method });
    return res.status(403).json({ error: "Invalid token" });
  }
  req.username = username;
  log("request", { user: username, method: req.method, path: req.path });
  next();
}

// Store active transports by session ID
const transports = new Map();

app.post("/mcp", authenticate, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  // Existing session — forward the message
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session — create server + transport
  const server = new McpServer({
    name: "apartmenthub",
    version: "1.0.0",
  });

  // Register all plugins
  for (const plugin of plugins) {
    plugin.register(server, { ...config, username: req.username });
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    onsessioninitialized: (id) => {
      transports.set(id, transport);
    },
  });

  transport.onclose = () => {
    const id = transport.sessionId;
    if (id) transports.delete(id);
  };

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Handle GET for SSE stream (required by some clients)
app.get("/mcp", authenticate, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !transports.has(sessionId)) {
    return res.status(400).json({ error: "Invalid or missing session" });
  }
  const transport = transports.get(sessionId);
  await transport.handleRequest(req, res);
});

// Handle DELETE for session cleanup
app.delete("/mcp", authenticate, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId);
    await transport.handleRequest(req, res);
    transports.delete(sessionId);
  } else {
    res.status(204).end();
  }
});

// --- Claude Code dispatch (SEO Develop button) ---
//
// Spawns a headless `claude -p` session on this server that autonomously
// implements an SEO suggestion, commits to the configured dispatch branch,
// and opens a PR. Fire-and-forget: returns 202 with a jobId immediately.
app.post("/dispatch/seo-develop", authenticate, (req, res) => {
  const {
    suggestion,
    type,
    dashboardContext,
    userPrompt,
    priorPrompts,
    isRefinement,
    jobId: incomingJobId,
  } = req.body || {};
  if (!suggestion || !type) {
    return res.status(400).json({ error: "suggestion and type are required" });
  }

  const jobId =
    typeof incomingJobId === "string" && /^[a-f0-9-]{36}$/.test(incomingJobId)
      ? incomingJobId
      : randomUUID();
  const logFile = join(DISPATCH_LOG_DIR, `${jobId}.log`);
  const logStream = createWriteStream(logFile, { flags: "a" });
  const prompt = buildSeoDevelopPrompt({
    type,
    suggestion,
    dashboardContext,
    jobId,
    user: req.username,
    userPrompt: typeof userPrompt === "string" ? userPrompt : "",
    priorPrompts: Array.isArray(priorPrompts) ? priorPrompts : [],
    isRefinement: Boolean(isRefinement),
  });

  logStream.write(
    `=== Job ${jobId} started ${new Date().toISOString()} ===\n` +
    `User: ${req.username}\nType: ${type}\nBranch: ${DISPATCH_BRANCH}\nRepo: ${config.repoPath}\n\n` +
    `--- PROMPT ---\n${prompt}\n\n--- OUTPUT ---\n`
  );

  log("dispatch_start", { jobId, user: req.username, type });

  let child;
  try {
    child = spawn(
      CLAUDE_BIN,
      ["-p", prompt, "--dangerously-skip-permissions"],
      {
        cwd: config.repoPath,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      }
    );
  } catch (err) {
    logStream.write(`\n=== Spawn failed: ${err.message} ===\n`);
    logStream.end();
    log("dispatch_spawn_error", { jobId, error: err.message });
    return res.status(500).json({ error: `Failed to spawn claude: ${err.message}` });
  }

  child.stdout.pipe(logStream, { end: false });
  child.stderr.pipe(logStream, { end: false });

  child.on("exit", (code) => {
    logStream.write(`\n=== Exited with code ${code} at ${new Date().toISOString()} ===\n`);
    logStream.end();
    log("dispatch_complete", { jobId, code });
  });

  child.on("error", (err) => {
    logStream.write(`\n=== Process error: ${err.message} ===\n`);
    logStream.end();
    log("dispatch_process_error", { jobId, error: err.message });
  });

  child.unref();

  res.status(202).json({ jobId, status: "dispatched", logFile: `${jobId}.log` });
});

// Peek at dispatch job logs (useful for debugging from the dashboard)
app.get("/dispatch/seo-develop/:jobId/log", authenticate, async (req, res) => {
  const { jobId } = req.params;
  if (!/^[a-f0-9-]{36}$/.test(jobId)) {
    return res.status(400).json({ error: "Invalid jobId" });
  }
  try {
    const { readFileSync, existsSync } = await import("node:fs");
    const path = join(DISPATCH_LOG_DIR, `${jobId}.log`);
    if (!existsSync(path)) return res.status(404).json({ error: "Job not found" });
    res.type("text/plain").send(readFileSync(path, "utf-8"));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildSeoDevelopPrompt({
  type,
  suggestion,
  dashboardContext,
  jobId,
  user,
  userPrompt,
  priorPrompts,
  isRefinement,
}) {
  const suggestionBlock = JSON.stringify(suggestion, null, 2);
  const contextBlock = dashboardContext
    ? JSON.stringify(dashboardContext, null, 2)
    : "(not provided)";

  const priorPromptsBlock =
    priorPrompts && priorPrompts.length > 0
      ? priorPrompts
          .map((p, i) => `  [${i + 1}] ${p}`)
          .join("\n")
      : "(none)";

  const currentPromptBlock = userPrompt
    ? userPrompt
    : "(none — implement the suggestion as-is)";

  const refinementBanner = isRefinement
    ? `\n=== REFINEMENT RUN ===\nThis is a follow-up on a previous dispatch for the same suggestion. The earlier work has already been pushed to "${DISPATCH_BRANCH}" and likely opened or amended a PR. Build on top of that work — do NOT redo it. If the new instruction conflicts with what was previously done, prefer the new instruction.\n`
    : "";

  return `You are being run HEADLESSLY to implement an SEO improvement flagged by the SEO dashboard. Work fully autonomously — do NOT ask questions, do NOT wait for confirmation, do NOT request clarification. Make decisions and proceed.

TASK TYPE: ${type}
TRIGGERED BY: ${user}
JOB ID: ${jobId}
${refinementBanner}
SUGGESTION TO IMPLEMENT:
${suggestionBlock}

BROADER DASHBOARD CONTEXT (the full AI analysis this suggestion came from — use it to understand priorities and trade-offs):
${contextBlock}

PRIOR USER INSTRUCTIONS for this job (oldest first — already acted on, included for continuity):
${priorPromptsBlock}

CURRENT USER INSTRUCTION (the thing to act on right now):
${currentPromptBlock}

=== INSTRUCTIONS (follow exactly) ===

1. Read CLAUDE.md at the repo root. It describes ApartmentHub's architecture, conventions, and rules.
2. Run: git fetch origin
3. Checkout the branch "${DISPATCH_BRANCH}":
   - If it exists on origin: git checkout ${DISPATCH_BRANCH} && git pull origin ${DISPATCH_BRANCH} --ff-only
   - Else, cut it from latest main: git checkout main && git pull origin main --ff-only && git checkout -b ${DISPATCH_BRANCH}
4. Analyze the suggestion against the codebase. Relevant areas are usually:
   - src/app/(main)/nl/** and src/app/(main)/en/** — bilingual routes
   - src/components/seo/** — SEO components (e.g. LocalBusinessSchema)
   - src/app/layout.jsx and per-route metadata exports
   - src/data/** — static content/translations
5. Implement the change. STAY IN SCOPE — only implement this one suggestion. No refactoring, no unrelated cleanups, no new dependencies unless strictly required.
6. If the change is content-facing and both /nl/ and /en/ routes exist for it, update both.
7. Run: npm run lint — fix any errors YOU introduced. Ignore pre-existing errors in files you did not touch.
8. Commit (stage only the specific files you changed):
   git add <your files>
   git commit -m "seo: <brief description> (job ${jobId.slice(0, 8)})"
9. Push: git push -u origin ${DISPATCH_BRANCH}
10. Open or update a PR:
    - Check: gh pr list --head ${DISPATCH_BRANCH} --base main --state open
    - If a PR exists, just add a comment summarizing this commit: gh pr comment <number> --body "..."
    - Else open one: gh pr create --base main --head ${DISPATCH_BRANCH} --title "SEO: <brief>" --body "<summary, job ${jobId}, type: ${type}>"
11. Exit.

=== HARD RULES (never violate) ===
- NEVER push to main. Only to ${DISPATCH_BRANCH}.
- NEVER force-push anything.
- NEVER modify .env files, secrets, credentials, or tokens.
- NEVER edit files under mcp-server/ — that's the infrastructure running you.
- NEVER delete or alter existing migration files.
- NEVER bypass the lint with --no-verify.

=== WHAT TO DO IF STUCK ===
If the suggestion is ambiguous, not actionable from the codebase, or requires information you don't have: do NOT guess. Write a file .seo-dispatch-blocked-${jobId}.md at the repo root explaining what's blocking you, commit it to ${DISPATCH_BRANCH}, push, and exit WITHOUT opening a PR. A human will review.

=== SCOPE GUARDRAIL ===
If you find yourself touching more than 5 files, stop and reconsider — the suggestion is almost certainly narrower than your current approach. Revert overreach and redo with a tighter scope.

Begin now.`;
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", plugins: plugins.map((p) => p.name), users: tokenMap.size });
});

app.listen(PORT, () => {
  console.log(`ApartmentHub MCP server running on port ${PORT}`);
});
