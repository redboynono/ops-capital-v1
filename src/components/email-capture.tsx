"use client";

import { useState } from "react";

/**
 * 邮箱留资卡片：把"暂不付费"的访客转成可反复触达的简报订阅列表。
 * 放在付费墙第二屏。低承诺（只要邮箱），是冷流量→付费的关键中间层。
 */
export function EmailCapture({
  locale = "zh",
  source = "paywall",
}: {
  locale?: "zh" | "en";
  source?: string;
}) {
  const en = locale === "en";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const t = {
    title: en ? "Not ready to subscribe? Get the free daily briefing" : "暂不订阅？先免费收每日简报",
    sub: en
      ? "One actionable insight in your inbox each morning. Unsubscribe anytime."
      : "每个交易日早晨一条可执行洞察，随时退订。",
    placeholder: en ? "you@email.com" : "你的邮箱",
    button: en ? "Get free briefing" : "免费订阅",
    sending: en ? "Submitting…" : "提交中…",
    done: en ? "✓ You're in. Check your inbox." : "✓ 订阅成功，留意收件箱。",
    error: en ? "Something went wrong, try again." : "提交失败，请重试。",
  };

  const submit = async () => {
    if (!email.trim() || state === "loading") return;
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale, source }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      setState(res.ok && data?.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="not-prose my-4 rounded-lg border border-border bg-surface-muted/60 p-4">
      <p className="text-[13px] font-semibold text-foreground">{t.title}</p>
      <p className="mt-1 text-[12px] text-muted">{t.sub}</p>
      {state === "done" ? (
        <p className="mt-3 text-[13px] font-medium text-[color:var(--success)]">{t.done}</p>
      ) : (
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.placeholder}
            className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={state === "loading"}
            className="btn-primary px-4 py-2 text-[12px] disabled:opacity-60"
          >
            {state === "loading" ? t.sending : t.button}
          </button>
          {state === "error" ? (
            <p className="w-full text-[12px] text-[color:var(--danger)]">{t.error}</p>
          ) : null}
        </form>
      )}
    </div>
  );
}
