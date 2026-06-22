"use client";

import { useCallback, useState } from "react";

export type XWatchItemDto = {
  id: string;
  source_username: string;
  tweet_id: string;
  tweet_text: string;
  tweet_url: string;
  posted_at: string;
  topic_type: string | null;
  tickers: string[];
  summary_md: string | null;
  ops_angle_md: string | null;
  reply_draft: string | null;
  reply_draft_zh: string | null;
  status: "pending" | "posted" | "skipped";
  posted_reply_tweet_id: string | null;
  posted_reply_at: string | null;
};

export type XWatchMetaDto = {
  username: string;
  readConfigured: boolean;
  postConfigured: boolean;
  lastPolledAt: string | null;
  pendingCount: number;
};

const TOPIC_LABEL: Record<string, string> = {
  framework: "主题框架",
  watchlist: "名单更新",
  conviction: "单票 conviction",
  rotation: "板块轮动",
  cheatsheet: "Cheatsheet",
  other: "其他",
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const s = iso.includes("T") ? iso : iso.replace(" ", "T");
  return s.slice(0, 16).replace("T", " ");
}

type CardMsg = { tone: "ok" | "err" | "info"; text: string; link?: string };

export function AdminXWatchPanel({
  initialItems,
  initialMeta,
}: {
  initialItems: XWatchItemDto[];
  initialMeta: XWatchMetaDto;
}) {
  const [items, setItems] = useState(initialItems);
  const [meta, setMeta] = useState(initialMeta);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const it of initialItems) m[it.id] = it.reply_draft ?? "";
    return m;
  });
  const [draftsZh, setDraftsZh] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const it of initialItems) m[it.id] = it.reply_draft_zh ?? "";
    return m;
  });
  const [cardMsg, setCardMsg] = useState<Record<string, CardMsg | undefined>>({});

  const refresh = useCallback(async () => {
    const q = filter === "pending" ? "?status=pending" : "";
    const res = await fetch(`/api/admin/x-watch${q}`);
    const data = (await res.json()) as { items?: XWatchItemDto[]; meta?: XWatchMetaDto };
    if (data.items) {
      setItems(data.items);
      setDrafts((prev) => {
        const next = { ...prev };
        for (const it of data.items!) next[it.id] = it.reply_draft ?? prev[it.id] ?? "";
        return next;
      });
      setDraftsZh((prev) => {
        const next = { ...prev };
        for (const it of data.items!) next[it.id] = it.reply_draft_zh ?? prev[it.id] ?? "";
        return next;
      });
    }
    if (data.meta) setMeta(data.meta);
  }, [filter]);

  const applyItem = (item: XWatchItemDto) => {
    setDrafts((d) => ({ ...d, [item.id]: item.reply_draft ?? "" }));
    setDraftsZh((d) => ({ ...d, [item.id]: item.reply_draft_zh ?? "" }));
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...item } : it)));
  };

  const copyDraft = async (id: string) => {
    const text = drafts[id]?.trim();
    if (!text) {
      setCardMsg((m) => ({ ...m, [id]: { tone: "err", text: "英文草稿为空" } }));
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCardMsg((m) => ({ ...m, [id]: { tone: "ok", text: "已复制英文草稿，可到 X 手动 Quote / 发推" } }));
    } catch {
      setCardMsg((m) => ({ ...m, [id]: { tone: "err", text: "复制失败，请手动选中复制" } }));
    }
  };

  const call = async (action: string, id?: string, extra?: Record<string, string>) => {
    setBusy(action + (id ?? ""));
    setMsg(null);
    if (id) setCardMsg((m) => ({ ...m, [id]: undefined }));
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 180_000);
    try {
      const res = await fetch("/api/admin/x-watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, ...extra }),
        signal: ac.signal,
      });
      let data: {
        ok?: boolean;
        error?: string;
        inserted?: number;
        analyzed?: number;
        replyTweetId?: string;
        posted?: boolean;
        item?: XWatchItemDto;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        const errText = `请求失败 (HTTP ${res.status})`;
        setMsg(errText);
        if (id) setCardMsg((m) => ({ ...m, [id]: { tone: "err", text: errText } }));
        return;
      }
      if (!res.ok || !data.ok) {
        const errText = data.error ?? `请求失败 (HTTP ${res.status})`;
        setMsg(errText);
        if (id) setCardMsg((m) => ({ ...m, [id]: { tone: "err", text: errText } }));
        return;
      }
      if (action === "poll") {
        setMsg(`拉取完成 · 新增 ${data.inserted ?? 0} 条 · AI 分析 ${data.analyzed ?? 0} 条`);
      } else if (action === "post_reply") {
        const link = data.replyTweetId
          ? `https://x.com/i/status/${data.replyTweetId}`
          : undefined;
        const okText = `✓ 发布成功${data.replyTweetId ? ` · tweet ${data.replyTweetId}` : ""}`;
        setMsg(okText);
        if (id) {
          setCardMsg((m) => ({
            ...m,
            [id]: { tone: "ok", text: "✓ 已成功回复到 X", link },
          }));
        }
      } else if (action === "save_draft") {
        setMsg("草稿已保存");
        if (id) setCardMsg((m) => ({ ...m, [id]: { tone: "ok", text: "草稿已保存" } }));
      } else if (action === "skip") {
        setMsg("已跳过");
      } else if (action === "analyze") {
        setMsg("已重新分析");
        if (data.item) applyItem(data.item);
      } else if (action === "generate_reply") {
        const draft = data.item?.reply_draft?.trim();
        if (draft && data.item) {
          applyItem(data.item);
          setMsg("已生成英文回复 + 中文对照");
          setCardMsg((m) => ({
            ...m,
            [data.item!.id]: { tone: "ok", text: "已生成英文回复与中文对照" },
          }));
        } else {
          const errText = "AI 未返回有效草稿，请重试或手动输入";
          setMsg(errText);
          if (id) setCardMsg((m) => ({ ...m, [id]: { tone: "err", text: errText } }));
        }
      } else if (action === "translate_reply") {
        if (data.item) {
          applyItem(data.item);
          setCardMsg((m) => ({
            ...m,
            [data.item!.id]: { tone: "ok", text: "已更新中文对照" },
          }));
        }
      }
      if (action === "post_reply" || action === "skip") {
        await refresh();
      } else if (action === "analyze" || action === "generate_reply" || action === "translate_reply") {
        /* item already applied */
      } else if (action !== "generate_reply") {
        await refresh();
      }
    } catch (e) {
      const errText =
        e instanceof DOMException && e.name === "AbortError"
          ? "AI 生成超时（3 分钟），请重试"
          : "网络错误";
      setMsg(errText);
      if (id) setCardMsg((m) => ({ ...m, [id]: { tone: "err", text: errText } }));
    } finally {
      window.clearTimeout(timer);
      setBusy(null);
    }
  };

  const shown = filter === "pending" ? items.filter((i) => i.status === "pending") : items;

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold">
              监听 @{meta.username}
              <span className="ml-2 font-normal text-muted">
                · 待审 {meta.pendingCount}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted">
              上次轮询 {fmtTime(meta.lastPolledAt)}
              {" · "}
              读 X {meta.readConfigured ? "✓" : "✗"}
              {" · "}
              发回复 {meta.postConfigured ? "✓" : "✗"}
            </p>
            {!meta.readConfigured ? (
              <p className="mt-2 text-[11px] text-[color:var(--danger)]">
                需配置 X_BEARER_TOKEN 或 OAuth2（/api/admin/x-oauth/start）
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => call("poll")}
              className="btn-primary px-3 py-1.5 text-[12px] disabled:opacity-50"
            >
              {busy === "poll" ? "拉取中…" : "立即拉取新帖"}
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-[12px] font-semibold ${
                filter === "pending" ? "bg-accent text-white" : "border border-border text-muted"
              }`}
              onClick={() => {
                setFilter("pending");
                void refresh();
              }}
            >
              待审
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1.5 text-[12px] font-semibold ${
                filter === "all" ? "bg-accent text-white" : "border border-border text-muted"
              }`}
              onClick={() => {
                setFilter("all");
                void refresh();
              }}
            >
              全部
            </button>
          </div>
        </div>
        {msg ? (
          <p
            className={`mt-2 text-[12px] font-semibold ${
              msg.startsWith("✓") || msg.includes("已生成") || msg.includes("已保存")
                ? "text-[color:var(--success)]"
                : msg.includes("失败") || msg.includes("超时") || msg.includes("未返回") || msg.includes("限制")
                  ? "text-[color:var(--danger)]"
                  : "text-muted"
            }`}
          >
            {msg}
          </p>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-soft">
          Cron 每 30 分钟自动拉取；AI 生成中文摘要 + OPS 角度 + 英文回复（附中文对照）。
          <span className="text-[color:var(--danger)]"> 注意：X 常限制未互动账号无法在别人帖下回复，失败时请「复制英文草稿」手动发。</span>
        </p>
      </section>

      {shown.length === 0 ? (
        <p className="card px-4 py-8 text-center text-[13px] text-muted">
          暂无{filter === "pending" ? "待审" : ""}条目，点「立即拉取新帖」
        </p>
      ) : (
        shown.map((item) => (
          <article key={item.id} className="card overflow-hidden">
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-surface-muted px-4 py-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  {TOPIC_LABEL[item.topic_type ?? "other"] ?? item.topic_type ?? "—"}
                  {item.tickers.length > 0 ? (
                    <span className="ml-2 font-mono normal-case">
                      {item.tickers.slice(0, 8).map((t) => `$${t}`).join(" ")}
                    </span>
                  ) : null}
                </span>
                <p className="mt-1 text-[11px] text-muted">{fmtTime(item.posted_at)}</p>
              </div>
              <span
                className={`text-[11px] font-semibold ${
                  item.status === "posted"
                    ? "text-[color:var(--success)]"
                    : item.status === "skipped"
                      ? "text-muted"
                      : "text-accent-strong"
                }`}
              >
                {item.status === "posted" ? "已回复" : item.status === "skipped" ? "已跳过" : "待审"}
              </span>
            </header>

            <div className="px-4 py-3">
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{item.tweet_text}</p>
              <a
                href={item.tweet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[12px] font-semibold text-accent-strong hover:underline"
              >
                在 X 打开 →
              </a>
            </div>

            {item.summary_md ? (
              <div className="border-t border-border px-4 py-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted">AI 摘要</h3>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground-soft">
                  {item.summary_md}
                </p>
              </div>
            ) : null}

            {item.ops_angle_md ? (
              <div className="border-t border-border bg-accent-soft/20 px-4 py-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted">OPS 价值链角度</h3>
                <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground-soft">
                  {item.ops_angle_md}
                </p>
              </div>
            ) : null}

            {item.status === "pending" ? (
              <div className="border-t border-border px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted">回复草稿（英文）</h3>
                  <span
                    className={`font-mono text-[10px] ${
                      (drafts[item.id]?.length ?? 0) > 280 ? "text-[color:var(--danger)]" : "text-muted"
                    }`}
                  >
                    {drafts[item.id]?.length ?? 0}/280
                  </span>
                </div>
                <textarea
                  value={drafts[item.id] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                  rows={3}
                  placeholder="点「AI 生成回复」自动生成英文草稿，或手动输入"
                  className="mt-2 w-full rounded border border-border bg-surface px-3 py-2 text-[13px] text-foreground outline-none focus:border-accent"
                />
                <div className="mt-3 rounded border border-border/80 bg-surface-muted px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      中文对照（仅 admin 可见，不会发到 X）
                    </h4>
                    <button
                      type="button"
                      disabled={Boolean(busy) || !(drafts[item.id]?.trim())}
                      onClick={() => call("translate_reply", item.id)}
                      className="text-[11px] font-semibold text-accent-strong hover:underline disabled:opacity-50"
                    >
                      {busy === `translate_reply${item.id}` ? "翻译中…" : "刷新中文"}
                    </button>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground-soft">
                    {draftsZh[item.id]?.trim() || "生成回复后自动显示中文；也可点「刷新中文」"}
                  </p>
                </div>
                {cardMsg[item.id] ? (
                  <p
                    className={`mt-3 rounded px-3 py-2 text-[12px] ${
                      cardMsg[item.id]!.tone === "ok"
                        ? "bg-[color:color-mix(in_srgb,var(--success)_12%,transparent)] text-[color:var(--success)]"
                        : cardMsg[item.id]!.tone === "err"
                          ? "bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] text-[color:var(--danger)]"
                          : "bg-surface-muted text-muted"
                    }`}
                  >
                    {cardMsg[item.id]!.text}
                    {cardMsg[item.id]!.link ? (
                      <>
                        {" "}
                        <a
                          href={cardMsg[item.id]!.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold underline"
                        >
                          查看回复 →
                        </a>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => call("generate_reply", item.id)}
                    className="btn-primary px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    {busy === `generate_reply${item.id}` ? "生成中…" : "AI 生成回复"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() =>
                      call("save_draft", item.id, { reply_draft: drafts[item.id] ?? "" })
                    }
                    className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    保存草稿
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => call("analyze", item.id)}
                    className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    完整 AI 分析
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy) || !(drafts[item.id]?.trim())}
                    onClick={() => copyDraft(item.id)}
                    className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    复制英文草稿
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy) || !meta.postConfigured}
                    onClick={() =>
                      call("post_reply", item.id, { reply_draft: drafts[item.id] ?? "" })
                    }
                    className="rounded border border-accent bg-accent/10 px-3 py-1.5 text-[12px] font-semibold text-accent-strong hover:bg-accent/20 disabled:opacity-50"
                  >
                    {busy === `post_reply${item.id}` ? "发布中…" : "发布回复"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => call("skip", item.id)}
                    className="rounded border border-border px-3 py-1.5 text-[12px] text-muted hover:text-foreground disabled:opacity-50"
                  >
                    跳过
                  </button>
                </div>
              </div>
            ) : item.status === "posted" && item.posted_reply_tweet_id ? (
              <div className="border-t border-border px-4 py-2 text-[11px] text-muted">
                已回复 ·{" "}
                <a
                  href={`https://x.com/i/status/${item.posted_reply_tweet_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-strong hover:underline"
                >
                  查看回复
                </a>
              </div>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
