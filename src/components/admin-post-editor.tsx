"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  post: {
    id: string;
    title: string;
    slug: string;
    kind: "analysis" | "news";
    excerpt: string;
    content: string;
    is_premium: number;
    is_published: number;
    tickers: string[];
  };
};

const input =
  "w-full rounded border border-border bg-surface px-3 py-2 text-[13px] outline-none focus:border-accent";

export function AdminPostEditor({ post }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [kind, setKind] = useState<"analysis" | "news">(post.kind);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [content, setContent] = useState(post.content);
  const [isPremium, setIsPremium] = useState(!!post.is_premium);
  const [isPublished, setIsPublished] = useState(!!post.is_published);
  const [tickersInput, setTickersInput] = useState(post.tickers.join(", "));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      const tickers = tickersInput
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          title,
          slug,
          kind,
          excerpt,
          content,
          is_premium: isPremium,
          is_published: isPublished,
          tickers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "保存失败");
      setMsg("已保存");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="card grid gap-3 p-4 md:grid-cols-2">
        <label className="block">
          <span className="label-caps">标题</span>
          <input className={`${input} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label-caps">Slug</span>
          <input className={`${input} mt-1 mono`} value={slug} onChange={(e) => setSlug(e.target.value)} required />
        </label>
        <label className="block">
          <span className="label-caps">类型</span>
          <select
            className={`${input} mt-1`}
            value={kind}
            onChange={(e) => setKind(e.target.value as "analysis" | "news")}
          >
            <option value="analysis">分析</option>
            <option value="news">快讯</option>
          </select>
        </label>
        <label className="block">
          <span className="label-caps">关联标的</span>
          <input
            className={`${input} mt-1 mono`}
            value={tickersInput}
            onChange={(e) => setTickersInput(e.target.value)}
            placeholder="NVDA, TSLA"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
          Premium
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
          已发布
        </label>
      </div>

      <label className="card block p-4">
        <span className="label-caps">摘要</span>
        <textarea className={`${input} mt-1 min-h-[60px]`} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
      </label>

      <label className="card block p-4">
        <span className="label-caps">正文 Markdown</span>
        <textarea
          className={`${input} mt-1 min-h-[360px] font-mono text-[12px]`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      </label>

      {err ? <p className="text-[13px] text-[color:var(--danger)]">{err}</p> : null}
      {msg ? <p className="text-[13px] text-[color:var(--success)]">{msg}</p> : null}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-[13px] disabled:opacity-50">
          {saving ? "保存中…" : "保存"}
        </button>
        <Link href="/admin/posts" className="btn-outline px-4 py-2 text-[13px]">
          返回列表
        </Link>
        {isPublished ? (
          <Link
            href={kind === "news" ? `/news/${slug}` : `/analysis/${slug}`}
            className="btn-outline px-4 py-2 text-[13px]"
            target="_blank"
          >
            预览
          </Link>
        ) : null}
      </div>
    </form>
  );
}
