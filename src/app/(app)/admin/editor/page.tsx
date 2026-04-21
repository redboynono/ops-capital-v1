"use client";

import { FormEvent, useMemo, useState } from "react";

type GenerateResult = { content: string };

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function extractTitle(md: string) {
  const h = md
    .split("\n")
    .find((l) => l.trim().startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();
  if (h) return h;
  return md.split("\n").find((l) => l.trim().length > 0)?.slice(0, 60) ?? "";
}

function extractExcerpt(md: string) {
  const compact = md
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return compact.slice(0, 180);
}

export default function AdminEditorPage() {
  const [kind, setKind] = useState<"analysis" | "news">("analysis");
  const [target, setTarget] = useState("");
  const [focus, setFocus] = useState("");
  const [tickersInput, setTickersInput] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [isPremium, setIsPremium] = useState(true);
  const [isPublished, setIsPublished] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const contentLength = useMemo(() => content.length, [content]);

  const onGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveMessage(null);
    if (!target.trim()) {
      setError("请先输入标的代码、宏观事件或公司名称");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/research/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, focus, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "生成失败");
        return;
      }
      const { content: next } = data as GenerateResult;
      setContent(next);
      const t = extractTitle(next);
      if (!title.trim()) setTitle(t);
      if (!slug.trim()) setSlug(slugify(t));
      if (!excerpt.trim()) setExcerpt(extractExcerpt(next));
      if (kind === "news") setIsPremium(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    setSaveMessage(null);
    if (!title.trim() || !slug.trim() || !content.trim()) {
      setError("请先补全 标题 / Slug / 正文");
      return;
    }
    try {
      setSaving(true);
      const tickers = tickersInput
        .split(/[,\s、，]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      const res = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          kind,
          excerpt,
          content,
          is_premium: kind === "news" ? false : isPremium,
          is_published: isPublished,
          tickers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "保存失败");
        return;
      }
      const basePath = kind === "news" ? "/news/" : "/analysis/";
      setSaveMessage(`保存成功：${basePath}${data?.post?.slug ?? slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存请求失败");
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full rounded border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-soft focus:border-accent";

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">后台 · 编辑器</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">AI 内容工作台</h1>
        <p className="mt-1 text-[13px] text-muted">
          选择内容类型 → 输入标的 → 一键生成 Markdown → 补全 tickers/发布设置 → 保存入库。
        </p>
      </header>

      {/* 输入 + 生成 */}
      <form onSubmit={onGenerate} className="card p-4 mb-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label-caps">内容类型</label>
          <div className="mt-1 inline-flex gap-1 rounded border border-border bg-surface p-0.5">
            {(["analysis", "news"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded px-3 py-1 text-[12px] font-semibold ${
                  kind === k ? "bg-accent text-white" : "text-muted hover:text-foreground"
                }`}
              >
                {k === "analysis" ? "分析 Analysis" : "快讯 News"}
              </button>
            ))}
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="label-caps">标的 / 事件</label>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="例如：NVDA / BTC / 美联储 6 月议息会议"
            className={input}
          />
        </div>

        <div className="md:col-span-2">
          <label className="label-caps">关注点（可选）</label>
          <textarea
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            rows={2}
            placeholder="例如：估值是否透支、未来 12 个月催化剂"
            className={input}
          />
        </div>

        <div className="md:col-span-2">
          <button type="submit" disabled={loading} className="btn-primary px-4 py-1.5 text-[13px]">
            {loading ? "生成中..." : "一键生成草稿"}
          </button>
        </div>

        {error ? <p className="md:col-span-2 text-[12px] text-[color:var(--danger)]">{error}</p> : null}
        {saveMessage ? <p className="md:col-span-2 text-[12px] text-[color:var(--success)]">{saveMessage}</p> : null}
      </form>

      {/* 编辑 + 保存 */}
      <div className="card p-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label-caps">标题</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        </div>

        <div>
          <label className="label-caps">Slug（URL）</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={input} />
        </div>

        <div>
          <label className="label-caps">关联标的（逗号/空格分隔）</label>
          <input
            value={tickersInput}
            onChange={(e) => setTickersInput(e.target.value)}
            placeholder="例如：NVDA, TSM, AVGO"
            className={input}
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-5 pt-1">
          {kind !== "news" ? (
            <label className="inline-flex items-center gap-2 text-[13px] text-foreground-soft">
              <input
                type="checkbox"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="accent-[color:var(--accent)]"
              />
              Premium（付费）
            </label>
          ) : null}
          <label className="inline-flex items-center gap-2 text-[13px] text-foreground-soft">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="accent-[color:var(--accent)]"
            />
            已发布
          </label>
        </div>

        <div className="md:col-span-2">
          <label className="label-caps">摘要</label>
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className={input} />
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between">
            <label className="label-caps">正文（Markdown）</label>
            <span className="text-[11px] text-muted">{contentLength} 字</span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className={`${input} font-mono`}
          />
        </div>

        <div className="md:col-span-2">
          <button type="button" onClick={onSave} disabled={saving} className="btn-primary px-4 py-1.5 text-[13px]">
            {saving ? "保存中..." : "保存到数据库"}
          </button>
        </div>
      </div>
    </div>
  );
}
