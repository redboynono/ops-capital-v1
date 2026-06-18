"use client";

import { useCallback, useState } from "react";

import type { FeedbackSummary } from "@/lib/content-feedback";

const VISITOR_COOKIE = "ops_vid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!) : null;
}

function ensureVisitorId(): string {
  let vid = readCookie(VISITOR_COOKIE);
  if (!vid) {
    vid = crypto.randomUUID();
    document.cookie = `${VISITOR_COOKIE}=${encodeURIComponent(vid)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  }
  return vid;
}

type Labels = {
  question: string;
  yes: string;
  no: string;
  thanks: string;
  publicFmt: string;
};

export function ContentFeedback({
  refType,
  refKey,
  initial,
  labels,
  readerMode = false,
}: {
  refType: "post" | "pick";
  refKey: string;
  initial: FeedbackSummary;
  labels: Labels;
  readerMode?: boolean;
}) {
  const [summary, setSummary] = useState(initial);
  const [pending, setPending] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

  const submit = useCallback(
    async (helpful: boolean) => {
      if (pending) return;
      setPending(true);
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            refType,
            refKey,
            helpful,
            visitorId: ensureVisitorId(),
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          summary?: FeedbackSummary;
        } | null;
        if (res.ok && data?.ok && data.summary) {
          setSummary(data.summary);
          setJustVoted(true);
          window.setTimeout(() => setJustVoted(false), 2500);
        }
      } finally {
        setPending(false);
      }
    },
    [pending, refKey, refType],
  );

  const borderCls = readerMode ? "border-[#d8d0c2]" : "border-border";
  const mutedCls = readerMode ? "text-[#6b5c3f]" : "text-muted-soft";
  const vote = summary.userVote;

  const publicLine =
    summary.helpfulPct != null
      ? labels.publicFmt
          .replace("{pct}", String(summary.helpfulPct))
          .replace("{n}", String(summary.total))
      : null;

  return (
    <div
      className={`not-prose my-6 rounded-lg border ${borderCls} bg-surface-muted/50 px-4 py-3`}
      aria-label={labels.question}
    >
      <p className={`text-[13px] font-medium ${readerMode ? "text-[#2c2416]" : "text-foreground"}`}>
        {justVoted ? labels.thanks : labels.question}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(true)}
          className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition ${
            vote === true
              ? "border-accent bg-accent/15 text-accent-strong"
              : `border-border bg-surface text-foreground-soft hover:border-accent/50`
          } disabled:opacity-50`}
        >
          👍 {labels.yes}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(false)}
          className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition ${
            vote === false
              ? "border-muted bg-surface-muted text-muted"
              : `border-border bg-surface text-foreground-soft hover:border-muted`
          } disabled:opacity-50`}
        >
          👎 {labels.no}
        </button>
        {publicLine ? (
          <span className={`text-[11px] ${mutedCls}`}>{publicLine}</span>
        ) : null}
      </div>
    </div>
  );
}
