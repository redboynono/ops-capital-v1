"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminPostListItem = {
  id: string;
  title: string;
  slug: string;
  kind: "analysis" | "news";
  is_premium: number;
  is_published: number;
  created_at: string;
  tickers: string[];
};

export function AdminPostsManager({ initial }: { initial: AdminPostListItem[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === initial.length) setSelected(new Set());
    else setSelected(new Set(initial.map((p) => p.id)));
  };

  const bulkPublish = async (published: boolean) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_published", ids, published }),
      });
      if (!res.ok) throw new Error("操作失败");
      setMsg(published ? `已发布 ${ids.length} 篇` : `已下架 ${ids.length} 篇`);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggleAll} className="btn-outline px-3 py-1 text-[12px]">
          {selected.size === initial.length ? "取消全选" : "全选"}
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => bulkPublish(true)}
          className="btn-primary px-3 py-1 text-[12px] disabled:opacity-50"
        >
          批量发布
        </button>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => bulkPublish(false)}
          className="btn-outline px-3 py-1 text-[12px] disabled:opacity-50"
        >
          批量下架
        </button>
        {msg ? <span className="text-[12px] text-accent-strong">{msg}</span> : null}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-[28px_1fr_72px_72px_100px] gap-2 border-b border-border bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <span />
          <span>标题</span>
          <span>类型</span>
          <span>状态</span>
          <span className="text-right">操作</span>
        </div>
        <ul className="divide-y divide-border">
          {initial.map((p) => (
            <li
              key={p.id}
              className="grid grid-cols-[28px_1fr_72px_72px_100px] items-center gap-2 px-3 py-2 text-[12px]"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="accent-[var(--accent)]"
              />
              <div className="min-w-0">
                <Link href={`/admin/posts/${p.id}`} className="truncate font-semibold hover:text-accent-strong">
                  {p.title}
                </Link>
                <p className="mono truncate text-[10px] text-muted">
                  /{p.kind}/{p.slug}
                  {p.tickers.length ? ` · ${p.tickers.join(",")}` : ""}
                </p>
              </div>
              <span>{p.kind === "news" ? "快讯" : "分析"}</span>
              <span className={p.is_published ? "text-[color:var(--success)]" : "text-muted"}>
                {p.is_published ? "已发布" : "草稿"}
              </span>
              <span className="text-right">
                <Link href={`/admin/posts/${p.id}`} className="text-accent-strong hover:underline">
                  编辑
                </Link>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
