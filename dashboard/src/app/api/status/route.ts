import { NextResponse } from "next/server";
import { getMcp } from "@/infra/mcp/http.client";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const health = await getMcp().health();
    return NextResponse.json({
      mcp: {
        url: env.mcpBaseUrl,
        reachable: true,
        ...health,
      },
      omium: {
        configured: Boolean(env.omiumUrl && env.omiumKey),
        projectId: env.omiumProjectId,
      },
      anthropic: { configured: Boolean(env.anthropicKey) },
      tavily: { configured: Boolean(env.tavilyKey) },
    });
  } catch (err) {
    return NextResponse.json(
      {
        mcp: {
          url: env.mcpBaseUrl,
          reachable: false,
          error: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 200 },
    );
  }
}
