"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, Sparkles, User2 } from "lucide-react";
import { AiAnswerBody } from "@/components/ai-answer";
import { useDict } from "@/components/locale-provider";

type Context =
  | { kind: "ticker"; symbol: string; suggestions?: string[] }
  | { kind: "post"; slug: string; suggestions?: string[] };

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AskAI({
  context,
  loggedIn,
  title,
  subtitle,
}: {
  context: Context;
  loggedIn: boolean;
  title?: string;
  subtitle?: string;
}) {
  const dict = useDict();
  const a = dict.askAi;
  const nav = dict.nav;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions =
    context.suggestions ??
    (context.kind === "ticker" ? a.suggestionsTicker : a.suggestionsPost);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    if (!loggedIn) return;

    setLoading(true);
    setError(null);
    const baseHistory: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages([...baseHistory, { role: "assistant", content: "" }]);
    setDraft("");

    try {
      const payload =
        context.kind === "ticker"
          ? { kind: "ticker", symbol: context.symbol, question, history: messages }
          : { kind: "post", slug: context.slug, question, history: messages };
      const res = await fetch("/api/research/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || ct.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        acc += chunk;
        setMessages((prev) => {
          const out = [...prev];
          const last = out[out.length - 1];
          if (last && last.role === "assistant") {
            out[out.length - 1] = { role: "assistant", content: acc };
          }
          return out;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : a.requestFail);
      setMessages(baseHistory);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card mt-6 p-4">
      <header className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm"
          style={{ background: "var(--accent)" }}
        >
          <Sparkles className="h-3.5 w-3.5 text-[#0a0a0d]" strokeWidth={2.4} />
        </span>
        <div className="flex-1">
          <h3 className="text-[13px] font-bold text-foreground">{title ?? a.title}</h3>
          <p className="text-[10px] text-muted">{subtitle ?? a.subtitle}</p>
        </div>
      </header>

      {messages.length > 0 ? (
        <div className="mb-3 space-y-3 max-h-[480px] overflow-y-auto rounded border border-border bg-surface-muted p-3">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const isStreamingAssistant = isLast && m.role === "assistant" && loading;
            return (
              <Bubble
                key={i}
                role={m.role}
                content={m.content}
                streaming={isStreamingAssistant}
                thinking={a.thinking}
              />
            );
          })}
        </div>
      ) : null}

      {messages.length === 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={!loggedIn || loading}
              onClick={() => ask(s)}
              className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] text-foreground-soft hover:border-accent hover:text-accent-strong disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {loggedIn ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(draft);
          }}
          className="flex h-9 items-center gap-2 rounded border border-border bg-surface px-2 focus-within:border-accent"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              context.kind === "ticker" ? a.placeholderTicker : a.placeholderPost
            }
            disabled={loading}
            className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-soft outline-none"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!draft.trim() || loading}
            className="inline-flex h-7 items-center justify-center rounded-sm px-2 disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#0a0a0d" }}
            aria-label={a.send}
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </form>
      ) : (
        <div className="rounded border border-dashed border-border bg-surface-muted px-3 py-3 text-[12px] text-muted">
          <Link href="/login" className="text-accent-strong hover:underline">
            {nav.login}
          </Link>
          {a.loginHint}
        </div>
      )}

      {error ? (
        <p className="mt-2 text-[11px] text-[color:var(--danger)]">⚠ {error}</p>
      ) : null}
    </section>
  );
}

function Bubble({
  role,
  content,
  streaming = false,
  thinking,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  thinking: string;
}) {
  if (role === "user") {
    return (
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground-soft/20 text-foreground-soft">
          <User2 className="h-3 w-3" strokeWidth={2} />
        </span>
        <p className="flex-1 text-[12px] leading-relaxed text-foreground">{content}</p>
      </div>
    );
  }
  const empty = !content;
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full ${
          streaming ? "animate-pulse" : ""
        }`}
        style={{ background: "var(--accent)" }}
      >
        <Sparkles className="h-3 w-3 text-[#0a0a0d]" strokeWidth={2.4} />
      </span>
      <div className="flex-1 text-[12px] leading-relaxed text-foreground-soft">
        {empty && streaming ? (
          <span className="text-muted">{thinking}</span>
        ) : (
          <AiAnswerBody content={content} streaming={streaming} />
        )}
      </div>
    </div>
  );
}
