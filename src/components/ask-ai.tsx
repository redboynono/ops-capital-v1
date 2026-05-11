"use client";

import Link from "next/link";
import { useState } from "react";
import { Send, Sparkles, User2 } from "lucide-react";

type Context =
  | { kind: "ticker"; symbol: string; suggestions?: string[] }
  | { kind: "post"; slug: string; suggestions?: string[] };

type ChatMessage = { role: "user" | "assistant"; content: string };

const DEFAULT_SUGGESTIONS_TICKER = [
  "当前估值贵不贵？跟同业比怎么样？",
  "最大的下行风险是什么？",
  "下个 3-6 个月最关键的催化剂是？",
];
const DEFAULT_SUGGESTIONS_POST = [
  "本文最核心的观点用一句话总结",
  "本文的论点有什么薄弱环节？",
  "和当前最新数据相比有没有过时的地方？",
];

export function AskAI({ context, loggedIn }: { context: Context; loggedIn: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions =
    context.suggestions ??
    (context.kind === "ticker" ? DEFAULT_SUGGESTIONS_TICKER : DEFAULT_SUGGESTIONS_POST);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    if (!loggedIn) return;

    setLoading(true);
    setError(null);
    const next: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(next);
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { answer: string };
      setMessages([...next, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
      setMessages(next); // keep user msg, drop assistant
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
          <h3 className="text-[13px] font-bold text-foreground">问 AI</h3>
          <p className="text-[10px] text-muted">
            实时 factsheet 加持 · 答案来自 OPS Quant + Finnhub 数据
          </p>
        </div>
      </header>

      {/* 历史 */}
      {messages.length > 0 ? (
        <div className="mb-3 space-y-3 max-h-[480px] overflow-y-auto rounded border border-border bg-surface-muted p-3">
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {loading ? (
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <Sparkles className="h-3 w-3 animate-pulse text-accent-strong" strokeWidth={2} />
              AI 正在思考…
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 推荐问题 */}
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

      {/* 输入框 */}
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
              context.kind === "ticker"
                ? "问点关于这只标的的具体问题…"
                : "问点关于这篇文章的具体问题…"
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
            aria-label="发送"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </form>
      ) : (
        <div className="rounded border border-dashed border-border bg-surface-muted px-3 py-3 text-[12px] text-muted">
          <Link href="/login" className="text-accent-strong hover:underline">
            登录
          </Link>{" "}
          后即可向 AI 提问；非会员每日有问答额度。
        </div>
      )}

      {error ? (
        <p className="mt-2 text-[11px] text-[color:var(--danger)]">⚠ {error}</p>
      ) : null}
    </section>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
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
  return (
    <div className="flex items-start gap-2">
      <span
        className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full"
        style={{ background: "var(--accent)" }}
      >
        <Sparkles className="h-3 w-3 text-[#0a0a0d]" strokeWidth={2.4} />
      </span>
      <div className="flex-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground-soft">
        {content}
      </div>
    </div>
  );
}
