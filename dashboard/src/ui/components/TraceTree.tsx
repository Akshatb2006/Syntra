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
  return "live";
}

const KIND_BADGE: Record<TraceSpan["kind"], string> = {
  agent: "agent",
  tool_call: "tool",
  llm_call: "llm",
  mcp_request: "mcp_tool",
  webhook: "webhook",
  async_dispatch: "dispatch",
  validation: "validation",
  internal: "internal",
};

function SpanNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isLive = node.span.durationMs === null;
  const isErr = node.span.status === "error";

  return (
    <>
      <div
        className={`trace-row${isLive ? ' live' : ''}`}
        style={{ paddingLeft: `${depth * 24}px`, cursor: hasChildren ? 'pointer' : 'default' }}
        onClick={() => hasChildren && setOpen(v => !v)}
      >
        <div className="trace-name">
          <span className="arr">{hasChildren ? (open ? '▼' : '▶') : '└'}</span>
          <span className={`nm${isLive ? ' live' : ''}${isErr ? '' : ''}`} style={isErr ? { color: 'var(--danger)' } : {}}>
            {node.span.name}
          </span>
          <span className="kind">{KIND_BADGE[node.span.kind]}</span>
        </div>
        <div className="trace-status">
          <span className={`dot ${isLive ? 'live pulse-soft' : isErr ? 'err' : 'ok'}`}></span>
        </div>
        <div className={`trace-dur mono${isLive ? ' live' : ''}`}>{durLabel(node.span)}</div>
      </div>
      {open && node.children.map(c => (
        <SpanNode key={c.span.spanId} node={c} depth={depth + 1} />
      ))}
    </>
  );
}

export function TraceTree({ spans }: { spans: TraceSpan[] }) {
  const roots = buildTree(spans);

  if (roots.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>
        No trace spans recorded yet.
      </div>
    );
  }

  return (
    <div>
      <div className="pane-header">
        <div>
          <div className="pane-title">Trace tree</div>
          <div className="pane-sub mono" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {spans.length} spans
          </div>
        </div>
      </div>
      <div className="trace-head">
        <span>Span</span>
        <span style={{ textAlign: 'right' }}>Status</span>
        <span style={{ textAlign: 'right' }}>Duration</span>
      </div>
      {roots.map(r => (
        <SpanNode key={r.span.spanId} node={r} depth={0} />
      ))}
    </div>
  );
}
