"use client";

import { Share2, X, Download, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SharePoster, type PickPoster, type PostPoster, type PosterData } from "./share-poster";

/** 必须是纯可序列化数据，Server → Client 可传（url 会在 client click 时拼） */
type ShareData = Omit<PostPoster, "url"> | Omit<PickPoster, "url">;

type Props = {
  /** 海报所需数据（不含 url，url 会在 client 用 window.origin 拼） */
  data: ShareData;
  /** 被分享页面的路径（相对路径，如 /analysis/xxx）。不传则用当前页面 */
  urlPath?: string;
  /** 按钮形态，默认 icon */
  variant?: "icon" | "icon-compact" | "button";
  /** 给外层加 className */
  className?: string;
  /** 下载文件名前缀，默认 ops_alpha_share */
  fileNamePrefix?: string;
  /** 阻止父级 Link/Button 冒泡（卡片里放按钮必需） */
  stopPropagation?: boolean;
};

export function ShareButton({
  data,
  urlPath,
  variant = "icon",
  className = "",
  fileNamePrefix = "ops_alpha_share",
  stopPropagation = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [resolvedData, setResolvedData] = useState<PosterData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      if (stopPropagation) {
        e.stopPropagation();
        e.preventDefault();
      }
      // 在 click 时拼 url（需要 window）
      const path = urlPath ?? window.location.pathname + window.location.search;
      const url = `${window.location.origin}${path}`;
      setResolvedData({ ...data, url } as PosterData);
      setError(null);
      setOpen(true);
    },
    [data, urlPath, stopPropagation],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    // 小延迟后清 data，避免动画期间 DOM 抖动
    setTimeout(() => setResolvedData(null), 200);
  }, []);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  const handleSave = useCallback(async () => {
    if (!posterRef.current) return;
    setSaving(true);
    setError(null);
    try {
      // 动态 import 避免 SSR 打包
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#0a0a0a",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${fileNamePrefix}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("[share-poster] save failed:", err);
      setError(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }, [fileNamePrefix]);

  const buttonNode =
    variant === "button" ? (
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-[12px] text-foreground-soft transition hover:border-accent hover:text-accent-strong ${className}`}
        title="生成分享海报"
      >
        <Share2 size={14} />
        分享
      </button>
    ) : (
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center justify-center rounded-sm text-muted transition hover:bg-surface-muted hover:text-accent-strong ${
          variant === "icon-compact" ? "h-6 w-6" : "h-8 w-8"
        } ${className}`}
        title="生成分享海报"
        aria-label="生成分享海报"
      >
        <Share2 size={variant === "icon-compact" ? 13 : 15} />
      </button>
    );

  return (
    <>
      {buttonNode}
      {open && resolvedData ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <p className="text-[12px] font-semibold">分享海报预览</p>
                <p className="text-[10px] text-muted">1080 × 1440 · 适配小红书 / 微博 / 朋友圈</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-auto bg-[#0a0a0a] p-5">
              <div
                className="mx-auto overflow-hidden rounded-md"
                style={{
                  width: 360,
                  height: 480,
                }}
              >
                <div
                  style={{
                    transform: "scale(0.3333333)",
                    transformOrigin: "top left",
                    width: 1080,
                    height: 1440,
                  }}
                >
                  <SharePoster ref={posterRef} data={resolvedData} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
              <p className="text-[11px] text-muted">
                {error ? (
                  <span className="text-[color:var(--danger)]">{error}</span>
                ) : (
                  "保存为 PNG 后可直接发小红书"
                )}
              </p>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary inline-flex items-center gap-1.5 px-4 py-1.5 text-[12px] disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {saving ? "生成中..." : "保存图片"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
