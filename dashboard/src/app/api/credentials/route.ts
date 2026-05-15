import { NextResponse, type NextRequest } from "next/server";
import { credentialsSchema } from "@growth/shared/schemas";
import { sqliteStore } from "@/infra/store/sqlite";
import { newId } from "@/lib/id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const id = newId("cred");
  sqliteStore.secrets.upsert(id, parsed.data);
  return NextResponse.json({ credentialsRef: id });
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  sqliteStore.secrets.delete(id);
  return NextResponse.json({ ok: true });
}
