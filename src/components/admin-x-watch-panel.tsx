"use client";

import { useCallback, useState } from "react";

import { X_WATCH_CATEGORY_LABEL } from "@/lib/x-watch-influencers";

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
  reply_quality_score: number | null;
  status: "pending" | "posted" | "skipped";
  posted_reply_tweet_id: string | null;
  posted_reply_at: string | null;
  post_mode: "reply" | "quote" | "mention" | null;
  last_post_error: string | null;
  auto_post_skip_reason: string | null;
  reply_impressions: number | null;
  reply_likes: number | null;
  reply_retweets: number | null;
  metrics_synced_at: string | null;
};

export type XWatchMetaDto = {
  username: string;
  watchUsernames: string[];
  influencerMeta: {
    mode: "env" | "registry";
    categories: string[];
    topN: number;
    totalAccounts: number;
    pollBatchSize: number;
    byCategory: Partial<Record<string, string[]>>;
  };
  readConfigured: boolean;
  postConfigured: boolean;
  autoReplyEnabled: boolean;
  autoReplyMinScore: number;
  lastPolledAt: string | null;
  pendingCount: number;
};

const POST_MODE_LABEL: Record<string, string> = {
  quote: "Quote",
  mention: "@ 提及",
  reply: "楼中回复",
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyDraft = async (id: string, item?: XWatchItemDto) => {
    const draft = drafts[id]?.trim();
    if (!draft) {
      setCardMsg((m) => ({ ...m, [id]: { tone: "err", text: "英文草稿为空" } }));
      return;
    }
    const lines = [draft];
    if (item?.tweet_url) lines.push("", item.tweet_url);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 2000);
      setCardMsg((m) => ({
        ...m,
        [id]: {
          tone: "ok",
          text: item?.tweet_url
            ? "已复制英文草稿 + 原帖链接，打开链接后 Quote 粘贴即可"
            : "已复制英文草稿，可到 X 手动 Quote / 发推",
        },
      }));
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
        autoPosted?: number;
        autoSkipped?: number;
        autoFailed?: number;
        metricsSynced?: number;
        polledUsernames?: string[];
        pollCursor?: number;
        totalAccounts?: number;
        inserted?: number;
        analyzed?: number;
        replyTweetId?: string;
        postMode?: string;
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
        const parts = [
          `拉取 ${data.polledUsernames?.length ?? 0}/${data.totalAccounts ?? meta.influencerMeta.totalAccounts} 账号 · 新增 ${data.inserted ?? 0} · 分析 ${data.analyzed ?? 0}`,
        ];
        if (meta.autoReplyEnabled) {
          parts.push(
            `自动 Quote ${data.autoPosted ?? 0} · 跳过 ${data.autoSkipped ?? 0} · 失败 ${data.autoFailed ?? 0}`,
          );
        }
        if (data.metricsSynced != null && data.metricsSynced > 0) {
          parts.push(`指标同步 ${data.metricsSynced} 条`);
        }
        setMsg(parts.join(" · "));
      } else if (action === "post_reply" || action === "post_quote") {
        const mode = data.postMode ? POST_MODE_LABEL[data.postMode] ?? data.postMode : "";
        const link = data.replyTweetId
          ? `https://x.com/i/status/${data.replyTweetId}`
          : undefined;
        const okText = `✓ 发布成功${mode ? `（${mode}）` : ""}${data.replyTweetId ? ` · tweet ${data.replyTweetId}` : ""}`;
        setMsg(okText);
        if (id) {
          setCardMsg((m) => ({
            ...m,
            [id]: { tone: "ok", text: `✓ 已成功发到 X${mode ? `（${mode}）` : ""}`, link },
          }));
        }
      } else if (action === "save_draft") {
        setMsg("草稿已保存");
        if (id) setCardMsg((m) => ({ ...m, [id]: { tone: "ok", text: "草稿已保存" } }));
      } else if (action === "skip") {
        setMsg("已跳过");
      } else if (action === "sync_metrics") {
        setMsg(`已同步 ${(data as { synced?: number }).synced ?? 0} 条 Quote 指标`);
        await refresh();
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
      if (action === "post_reply" || action === "post_quote" || action === "skip") {
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
              X Watch · {meta.influencerMeta.totalAccounts} 账号
              {meta.influencerMeta.mode === "registry" ? (
                <span className="ml-1 font-normal text-muted">
                  （
                  {meta.influencerMeta.categories
                    .map((c) => X_WATCH_CATEGORY_LABEL[c as keyof typeof X_WATCH_CATEGORY_LABEL] ?? c)
                    .join(" / ")}
                  {" "}各 TOP{meta.influencerMeta.topN}）
                </span>
              ) : null}
              <span className="ml-2 font-normal text-muted">· 待审 {meta.pendingCount}</span>
            </p>
            <p className="mt-1 text-[11px] text-muted">
              上次轮询 {fmtTime(meta.lastPolledAt)}
              {" · "}
              本轮批量 {meta.influencerMeta.pollBatchSize}/{meta.influencerMeta.totalAccounts}
              {" · "}
              读 X {meta.readConfigured ? "✓" : "✗"}
              {" · "}
              发回复 {meta.postConfigured ? "✓" : "✗"}
              {" · "}
              自动 Quote {meta.autoReplyEnabled ? `✓ ≥${meta.autoReplyMinScore}分` : "✗ 关"}
            </p>
            {meta.influencerMeta.mode === "registry" ? (
              <details className="mt-2 text-[11px] text-muted-soft">
                <summary className="cursor-pointer font-semibold text-muted">
                  查看 {meta.influencerMeta.totalAccounts} 个监听账号
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {Object.entries(meta.influencerMeta.byCategory).map(([cat, handles]) => (
                    <div key={cat}>
                      <p className="font-semibold uppercase text-muted">
                        {X_WATCH_CATEGORY_LABEL[cat as keyof typeof X_WATCH_CATEGORY_LABEL] ?? cat}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] leading-relaxed">
                        {(handles ?? []).map((h) => `@${h}`).join(" ")}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            ) : (
              <p className="mt-1 font-mono text-[10px] text-muted-soft">
                {meta.watchUsernames.map((u) => `@${u}`).join(" · ")}
              </p>
            )}
            {!meta.autoReplyEnabled ? (
              <p className="mt-1 text-[11px] text-muted-soft">
                自动回复：<code className="font-mono">X_WATCH_AUTO_REPLY=1</code>
                {" · "}
                三赛道 TOP20：<code className="font-mono">X_WATCH_CATEGORIES=ai,finance,semiconductor</code>
              </p>
            ) : null}
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
              disabled={Boolean(busy)}
              onClick={() => call("sync_metrics")}
              className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
            >
              {busy === "sync_metrics" ? "同步中…" : "同步 Quote 数据"}
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
          Cron 每 5 分钟轮询（每轮 {meta.influencerMeta.pollBatchSize} 账号，全量约{" "}
          {Math.ceil(meta.influencerMeta.totalAccounts / Math.max(meta.influencerMeta.pollBatchSize, 1)) * 5}{" "}
          分钟）；AI / 金融 / 半导体各 TOP{meta.influencerMeta.topN}。原创帖 9:00 + 14:30。
          <span className="text-muted"> 楼中回复仍受 X 互动限制。</span>
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
                  @{item.source_username} · {TOPIC_LABEL[item.topic_type ?? "other"] ?? item.topic_type ?? "—"}
                  {item.reply_quality_score != null ? (
                    <span
                      className={`ml-2 font-mono normal-case ${
                        item.reply_quality_score >= meta.autoReplyMinScore
                          ? "text-[color:var(--success)]"
                          : "text-[color:var(--danger)]"
                      }`}
                    >
                      AI {item.reply_quality_score}/10
                    </span>
                  ) : null}
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
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] ${
                        (drafts[item.id]?.length ?? 0) > 280 ? "text-[color:var(--danger)]" : "text-muted"
                      }`}
                    >
                      {drafts[item.id]?.length ?? 0}/280
                    </span>
                    <button
                      type="button"
                      disabled={Boolean(busy) || !(drafts[item.id]?.trim())}
                      onClick={() => copyDraft(item.id, item)}
                      className={`rounded px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                        copiedId === item.id
                          ? "bg-[color:color-mix(in_srgb,var(--success)_15%,transparent)] text-[color:var(--success)]"
                          : "bg-accent/15 text-accent-strong hover:bg-accent/25"
                      }`}
                    >
                      {copiedId === item.id ? "已复制 ✓" : "一键复制"}
                    </button>
                  </div>
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
                {item.auto_post_skip_reason && item.status === "pending" ? (
                  <p className="mt-3 rounded bg-surface-muted px-3 py-2 text-[12px] text-muted">
                    未自动 Quote：{item.auto_post_skip_reason}
                  </p>
                ) : null}
                {item.last_post_error && item.status === "pending" ? (
                  <p className="mt-3 rounded bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] px-3 py-2 text-[12px] text-[color:var(--danger)]">
                    上次发帖失败：{item.last_post_error}
                  </p>
                ) : null}
                {cardMsg[item.id] ? (
                  <div
                    className={`mt-3 rounded px-3 py-2 text-[12px] ${
                      cardMsg[item.id]!.tone === "ok"
                        ? "bg-[color:color-mix(in_srgb,var(--success)_12%,transparent)] text-[color:var(--success)]"
                        : cardMsg[item.id]!.tone === "err"
                          ? "bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] text-[color:var(--danger)]"
                          : "bg-surface-muted text-muted"
                    }`}
                  >
                    <p>
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
                    {cardMsg[item.id]!.tone === "err" &&
                    (drafts[item.id]?.trim()) &&
                    cardMsg[item.id]!.text.includes("复制") ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => copyDraft(item.id, item)}
                          className="rounded bg-accent px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {copiedId === item.id ? "已复制 ✓" : "一键复制草稿 + 原帖链接"}
                        </button>
                        <a
                          href={item.tweet_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded border border-current px-3 py-1 text-[11px] font-semibold hover:opacity-80"
                        >
                          打开原帖 →
                        </a>
                      </div>
                    ) : null}
                  </div>
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
                    onClick={() => copyDraft(item.id, item)}
                    className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    {copiedId === item.id ? "已复制 ✓" : "复制草稿 + 链接"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy) || !meta.postConfigured || !(drafts[item.id]?.trim())}
                    onClick={() =>
                      call("post_quote", item.id, { reply_draft: drafts[item.id] ?? "" })
                    }
                    className="btn-primary px-3 py-1.5 text-[12px] disabled:opacity-50"
                  >
                    {busy === `post_quote${item.id}` ? "发布中…" : "Quote 发布"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy) || !meta.postConfigured}
                    onClick={() =>
                      call("post_reply", item.id, { reply_draft: drafts[item.id] ?? "" })
                    }
                    className="rounded border border-border px-3 py-1.5 text-[12px] text-muted hover:text-foreground disabled:opacity-50"
                  >
                    {busy === `post_reply${item.id}` ? "发布中…" : "楼中回复"}
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
                已发布
                {item.post_mode ? `（${POST_MODE_LABEL[item.post_mode] ?? item.post_mode}）` : ""}
                {item.reply_impressions != null ? (
                  <span className="ml-2 font-mono">
                    · 👁 {item.reply_impressions.toLocaleString()} · ♥ {item.reply_likes ?? 0} · ↻{" "}
                    {item.reply_retweets ?? 0}
                  </span>
                ) : null}{" "}
                ·{" "}
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
