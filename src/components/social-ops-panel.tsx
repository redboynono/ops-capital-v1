"use client";

import { useCallback, useEffect, useState } from "react";
import { X_CHAR_LIMIT, X_PREMIUM_TARGET } from "@/lib/social/constants";
import type { SocialPoolItem } from "@/lib/social/pool";
import type { SocialOpsRecord } from "@/lib/social/records";

function xLen(s: string): number {
  return [...s].length;
}

type ApiPayload = {
  pool: SocialPoolItem[];
  records: SocialOpsRecord[];
};

const STATUS_LABEL: Record<SocialOpsRecord["status"], string> = {
  draft: "草稿",
  posted_x: "已发 X",
  posted_xhs: "已发小红书",
  done: "已完成",
};

function statusCls(status: SocialOpsRecord["status"]): string {
  if (status === "done") return "bg-[color:var(--success)]/15 text-[color:var(--success)]";
  if (status === "draft") return "bg-surface-muted text-muted";
  return "bg-accent/15 text-accent-strong";
}

export function SocialOpsPanel() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const flash = useCallback((msg: string) => {
    setHint(msg);
    window.setTimeout(() => setHint(null), 2600);
  }, []);

  const copyText = useCallback(
    async (text: string, okMsg: string) => {
      try {
        await navigator.clipboard.writeText(text);
        flash(okMsg);
      } catch {
        flash("复制失败，请手动选中复制");
      }
    },
    [flash],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/social");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "加载失败");
      setData({ pool: json.pool ?? [], records: json.records ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createDraft = async (item: SocialPoolItem) => {
    setBusy(`draft:${item.key}`);
    try {
      const res = await fetch("/api/admin/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType: item.contentType,
          refKey: item.refKey,
          title: item.title,
          canonicalUrl: item.xUrl,
          xCopy: item.xCopy,
          xhsCopy: item.xhsCopy,
          utmCampaign: item.utmCampaign,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "创建失败");
      flash("已保存草稿");
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(null);
    }
  };

  const markPosted = async (id: string, channel: "x" | "xhs") => {
    setBusy(`mark:${id}:${channel}`);
    try {
      const res = await fetch(`/api/admin/social/records/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(channel === "x" ? { markPostedX: true } : { markPostedXhs: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "更新失败");
      flash(channel === "x" ? "已标记 X 发布" : "已标记小红书发布");
      await load();
    } catch (e) {
      flash(e instanceof Error ? e.message : "更新失败");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <p className="text-[13px] text-muted">加载内容池…</p>;
  }

  if (error) {
    return (
      <div className="card border-[color:var(--danger)]/30 p-4">
        <p className="text-[13px] text-[color:var(--danger)]">{error}</p>
        {error.includes("017_social_ops") ? (
          <p className="mt-2 font-mono text-[11px] text-muted">
            mysql -u … &lt; mysql/migrations/017_social_ops.sql
          </p>
        ) : null}
        <button type="button" onClick={() => void load()} className="btn-outline mt-3 px-3 py-1.5 text-[12px]">
          重试
        </button>
      </div>
    );
  }

  const pool = data?.pool ?? [];
  const records = data?.records ?? [];

  return (
    <div className="space-y-5">
      {hint ? (
        <p className="rounded-sm border border-accent/30 bg-accent-soft px-3 py-2 text-[12px] text-accent-strong">
          {hint}
        </p>
      ) : null}

      <section className="card">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-[12px] font-bold text-foreground">推荐内容池</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            X Premium 长文 · 每日 5 篇英文深度研报自动分发 · 评级/快讯手动池
          </p>
        </header>
        {pool.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted">暂无推荐，或均已进入草稿队列</p>
        ) : (
          <div className="divide-y divide-border">
            {pool.map((item) => (
              <div key={item.key} className="px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted">
                      {item.contentType} · {item.refKey}
                    </p>
                    <h3 className="mt-0.5 text-[13px] font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted">{item.subtitle}</p>
                    {item.xUrl.includes("/s/") ? (
                      <p className="mt-1 mono text-[10px] text-accent-strong">{item.xUrl}</p>
                    ) : null}
                  </div>
                  <span className="mono text-[10px] text-muted">P{item.priority}</span>
                </div>
                <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-surface-muted p-2 font-sans text-[11px] leading-relaxed text-foreground-soft">
                  {item.xCopy}
                </pre>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-outline px-2.5 py-1 text-[11px]"
                    onClick={() => void copyText(item.xCopy, "X 长文已复制")}
                  >
                    复制 X 长文
                    <span
                      className={`ml-1 mono text-[9px] ${
                        xLen(item.xCopy) > X_CHAR_LIMIT ? "text-[color:var(--danger)]" : "text-muted"
                      }`}
                    >
                      ({xLen(item.xCopy)} chars
                      {xLen(item.xCopy) <= X_PREMIUM_TARGET ? " · Premium" : ""})
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-outline px-2.5 py-1 text-[11px]"
                    onClick={() => void copyText(item.xhsCopy, "小红书文案已复制")}
                  >
                    复制小红书
                  </button>
                  <button
                    type="button"
                    disabled={busy === `draft:${item.key}`}
                    className="btn-primary px-2.5 py-1 text-[11px] disabled:opacity-50"
                    onClick={() => void createDraft(item)}
                  >
                    {busy === `draft:${item.key}` ? "…" : "存草稿"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <header className="border-b border-border px-3 py-2">
          <h2 className="text-[12px] font-bold text-foreground">草稿与发布记录</h2>
          <p className="mt-0.5 text-[11px] text-muted">发布后点「标记已发」追踪 UTM 转化</p>
        </header>
        {records.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-muted">还没有记录，从上方内容池存草稿开始</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12px]">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-normal">标题</th>
                  <th className="px-3 py-2 font-normal">类型</th>
                  <th className="px-3 py-2 font-normal">状态</th>
                  <th className="px-3 py-2 font-normal">更新</th>
                  <th className="px-3 py-2 font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <p className="line-clamp-2 font-medium text-foreground">{r.title}</p>
                      {r.utm_campaign ? (
                        <p className="mt-0.5 mono text-[10px] text-muted">utm: {r.utm_campaign}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 mono text-[11px] text-muted">{r.content_type}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${statusCls(r.status)}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 mono text-[10px] text-muted">
                      {r.updated_at?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="btn-outline px-2 py-0.5 text-[10px]"
                          onClick={() => void copyText(r.x_copy, "X 文案已复制")}
                        >
                          X
                        </button>
                        <button
                          type="button"
                          className="btn-outline px-2 py-0.5 text-[10px]"
                          onClick={() => void copyText(r.xhs_copy, "小红书文案已复制")}
                        >
                          小红书
                        </button>
                        {r.status !== "done" && !r.posted_x_at ? (
                          <button
                            type="button"
                            disabled={busy === `mark:${r.id}:x`}
                            className="btn-outline px-2 py-0.5 text-[10px] disabled:opacity-50"
                            onClick={() => void markPosted(r.id, "x")}
                          >
                            标记 X
                          </button>
                        ) : null}
                        {r.status !== "done" && !r.posted_xhs_at ? (
                          <button
                            type="button"
                            disabled={busy === `mark:${r.id}:xhs`}
                            className="btn-outline px-2 py-0.5 text-[10px] disabled:opacity-50"
                            onClick={() => void markPosted(r.id, "xhs")}
                          >
                            标记小红书
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button type="button" onClick={() => void load()} className="btn-outline px-3 py-1.5 text-[12px]">
        刷新
      </button>
    </div>
  );
}
