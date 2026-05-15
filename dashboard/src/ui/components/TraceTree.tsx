"use client";
import { useState } from "react";
import type { TraceSpan } from "@growth/shared/types";

interface TreeNode {
  span: TraceSpan;
  children: TreeNode[];
}

function buildTree(spans: TraceSpan[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const s of spans) byId.set(s.spanId, { span: s, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    const p = node.span.parentSpanId;
    if (p && byId.has(p)) byId.get(p)!.children.push(node);
    else roots.push(node);
  }
  const sortByStart = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.span.startTime - b.span.startTime);
    for (const n of nodes) sortByStart(n.children);
  };
  sortByStart(roots);
  return roots;
}

function durLabel(span: TraceSpan): string {
  if (span.durationMs !== null) {
    const d = span.durationMs;
    if (d < 1000) return `${d}ms`;
    if (d < 60_000) return `${(d / 1000).toFixed(1)}s`;
    return `${(d / 60_000).toFixed(1)}m`;
  }
  return "running…";
}

const KIND_COLOR: Record<TraceSpan["kind"], string> = {
  agent: "text-teal-300",
  tool_call: "text-amber-300",
  llm_call: "text-fuchsia-300",
  mcp_request: "text-sky-300",
  webhook: "text-orange-300",
  async_dispatch: "text-emerald-300",
  validation: "text-lime-300",
  internal: "text-zinc-400",
};

function Node({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const errored = node.span.status === "error";
  return (
    <div>
      <button
        onClick={() => hasChildren && setOpen((v) => !v)}
        className={`flex w-full items-start gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-[var(--bg-elev)] ${
          errored ? "text-rose-400" : "text-[var(--fg)]"
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <span className="mt-0.5 w-2 text-[var(--fg-muted)]">
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </span>
        <span className={`shrink-0 ${KIND_COLOR[node.span.kind]}`}>
          {node.span.kind}
        </span>
        <span className="flex-1 truncate">{node.span.name}</span>
        <span className="shrink-0 text-[var(--fg-muted)]">{durLabel(node.span)}</span>
      </button>
      {open &&
        node.children.map((c) => (
          <Node key={c.span.spanId} node={c} depth={depth + 1} />
        ))}
    </div>
  );
}

export function TraceTree({ spans }: { spans: TraceSpan[] }) {
  const roots = buildTree(spans);
  if (roots.length === 0) {
    return (
      <div className="text-sm text-[var(--fg-muted)]">No spans recorded yet.</div>
    );
  }
  return (
    <div className="space-y-1 font-mono">
      {roots.map((r) => (
        <Node key={r.span.spanId} node={r} depth={0} />
      ))}
    </div>
  );
}
