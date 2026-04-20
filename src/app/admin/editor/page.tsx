"use client";

import { FormEvent, useMemo, useState } from "react";

type GenerateResult = {
  content: string;
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function extractTitle(markdown: string) {
  const heading = markdown
    .split("\n")
    .find((line) => line.trim().startsWith("# "))
    ?.replace(/^#\s+/, "")
    .trim();

  if (heading) return heading;
  return markdown.split("\n").find((line) => line.trim().length > 0)?.slice(0, 60) ?? "";
}

function extractExcerpt(markdown: string) {
  const noHeading = markdown
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");

  const compact = noHeading.replace(/\s+/g, " ").trim();
  return compact.slice(0, 180);
}

export default function AdminEditorPage() {
  const [target, setTarget] = useState("");
  const [focus, setFocus] = useState("");

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

  const onGenerate = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaveMessage(null);

    if (!target.trim()) {
      setError("请先输入标的代码、宏观事件或公司名称");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/research/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, focus }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "生成失败");
        return;
      }

      const result = data as GenerateResult;
      const nextContent = result.content ?? "";
      const nextTitle = extractTitle(nextContent);
      const nextExcerpt = extractExcerpt(nextContent);

      setContent(nextContent);
      if (!title.trim()) setTitle(nextTitle);
      if (!slug.trim()) setSlug(slugify(nextTitle));
      if (!excerpt.trim()) setExcerpt(nextExcerpt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const onSave = async () => {
    setError(null);
    setSaveMessage(null);

    if (!title.trim() || !slug.trim() || !excerpt.trim() || !content.trim()) {
      setError("请先补全 Title / Slug / Excerpt / Content");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          content,
          is_premium: isPremium,
          is_published: isPublished,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data?.error ?? "保存失败");
        return;
      }

      setSaveMessage(`保存成功：/reports/${data?.post?.slug ?? slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存请求失败");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-border/80 bg-surface/60 px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:bg-surface-elevated";

  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(176,139,87,0.12),transparent_40%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-8 pt-12 md:px-6 md:pt-16">
        <section className="rise-in">
          <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">后台 · 编辑器</p>
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-4xl leading-[1.05] text-foreground md:text-5xl">
            AI 研报工作台
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            一键生成机构级 Markdown 研报草稿，再打磨标题、Slug、摘要与正文，保存到
            <code className="text-accent-soft">posts</code> 表。
          </p>
        </section>

        <form
          onSubmit={onGenerate}
          className="glass-panel rise-in mt-8 grid gap-4 rounded-3xl p-6 md:grid-cols-2 md:p-7"
          style={{ animationDelay: "80ms" }}
        >
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">标的 / 事件</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例如：NVDA / BTC / 美联储 6 月议息会议"
              className={inputClass}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">关注点（可选）</label>
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              rows={3}
              placeholder="例如：估值是否透支、未来 12 个月催化剂"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="primary-cta rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "生成中..." : "一键生成研报"}
            </button>
          </div>

          {error ? <p className="md:col-span-2 text-sm text-red-300">{error}</p> : null}
          {saveMessage ? <p className="md:col-span-2 text-sm text-accent-soft">{saveMessage}</p> : null}
        </form>

        <div
          className="glass-panel rise-in mt-8 grid gap-4 rounded-3xl p-6 md:grid-cols-2 md:p-7"
          style={{ animationDelay: "140ms" }}
        >
          <div className="space-y-2 md:col-span-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">标题</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">Slug（URL）</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
          </div>

          <div className="flex items-center gap-6 pt-6">
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="accent-[color:var(--accent)]"
              />
              付费
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="accent-[color:var(--accent)]"
              />
              已发布
            </label>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">摘要</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-[0.22em] text-muted">正文（Markdown）</label>
              <span className="text-xs text-muted">{contentLength} 字</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className={`${inputClass} font-mono`}
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="primary-cta rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存到数据库"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
