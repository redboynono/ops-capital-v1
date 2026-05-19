"use client";

import { parseCitationSegments } from "@/lib/ai/citations";

export function AiAnswerBody({ content, streaming }: { content: string; streaming?: boolean }) {
  const segments = parseCitationSegments(content);
  const citations = segments.filter((s) => s.type === "cite") as { type: "cite"; source: string; index: number }[];

  return (
    <>
      <div className="whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <span key={i}>{seg.value}</span>
          ) : (
            <sup
              key={i}
              className="ml-0.5 cursor-help text-[9px] font-semibold text-accent-strong"
              title={seg.source}
            >
              [{seg.index}]
            </sup>
          ),
        )}
        {streaming ? (
          <span className="ml-0.5 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse bg-accent-strong" />
        ) : null}
      </div>
      {citations.length > 0 && !streaming ? (
        <ol className="mt-3 space-y-1 border-t border-border pt-2 text-[10px] text-muted">
          {citations.map((c) => (
            <li key={c.index}>
              <span className="font-mono text-accent-strong">[{c.index}]</span> {c.source}
            </li>
          ))}
        </ol>
      ) : null}
    </>
  );
}
