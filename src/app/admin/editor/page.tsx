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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        <h1 className="text-2xl font-semibold md:text-3xl">Admin Editor · AI 投研生成</h1>
        <p className="mt-2 text-sm text-zinc-400">
          输入标的后一键生成机构级 Markdown 研报草稿，并回填到正文编辑区。
        </p>
        <p className="mt-1 text-xs text-zinc-500">提示：先生成，再点保存即可写入 `posts` 表。</p>

        <form onSubmit={onGenerate} className="mt-6 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-zinc-300">标的 / 事件</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例如：NVDA / BTC / 美联储6月议息会议"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-zinc-300">关注点（可选）</label>
            <textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              rows={3}
              placeholder="例如：关注估值是否透支、未来12个月催化剂"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "生成中..." : "一键生成研报"}
            </button>
          </div>

          {error ? <p className="md:col-span-2 text-sm text-red-400">{error}</p> : null}
          {saveMessage ? <p className="md:col-span-2 text-sm text-emerald-400">{saveMessage}</p> : null}
        </form>

        <div className="mt-8 grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-zinc-300">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-300">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-6 pt-6">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} />
              Premium
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              Published
            </label>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-zinc-300">Excerpt</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-zinc-300">Content (Markdown)</label>
              <span className="text-xs text-zinc-500">{contentLength} chars</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存到数据库"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
