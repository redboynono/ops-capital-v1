"use client";

import { ChevronLeft, ChevronRight, Download, Loader2, Share2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SlideContent } from "./share-poster";
import {
  buildSlides,
  slideFileName,
  type PickPoster,
  type PosterData,
  type PostPoster,
  type Slide,
} from "./share-slides";

/** 必须是纯可序列化数据，Server → Client 可传（url 会在 client click 时拼） */
type ShareData = Omit<PostPoster, "url"> | Omit<PickPoster, "url">;

type Props = {
  data: ShareData;
  /** 被分享页面的相对路径，不传则用当前页面 */
  urlPath?: string;
  variant?: "icon" | "icon-compact" | "button";
  className?: string;
  /** zip 文件名前缀，默认 ops_alpha_share */
  fileNamePrefix?: string;
  stopPropagation?: boolean;
};

const POSTER_W = 1080;
const POSTER_H = 1440;
// 预览缩放：360 / 1080 = 0.333...
const PREVIEW_SCALE = 1 / 3;

export function ShareButton({
  data,
  urlPath,
  variant = "icon",
  className = "",
  fileNamePrefix = "ops_alpha_share",
  stopPropagation = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 计算 slides（仅在 url 已确定时）
  const slides: Slide[] = useMemo(() => {
    if (!resolvedUrl) return [];
    return buildSlides({ ...data, url: resolvedUrl } as PosterData);
  }, [data, resolvedUrl]);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      if (stopPropagation) {
        e.stopPropagation();
        e.preventDefault();
      }
      const path = urlPath ?? window.location.pathname + window.location.search;
      const url = `${window.location.origin}${path}`;
      setResolvedUrl(url);
      setCarouselIndex(0);
      setError(null);
      setProgress(null);
      setOpen(true);
    },
    [urlPath, stopPropagation],
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(() => {
      setResolvedUrl(null);
      slideRefs.current = [];
    }, 200);
  }, []);

  // Esc / 箭头 键
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      else if (e.key === "ArrowRight")
        setCarouselIndex((i) => Math.min(i + 1, slides.length - 1));
      else if (e.key === "ArrowLeft") setCarouselIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose, slides.length]);

  const handleDownloadAll = useCallback(async () => {
    if (slides.length === 0) return;
    setSaving(true);
    setError(null);
    setProgress({ done: 0, total: slides.length });
    try {
      const [{ toPng }, JSZip, { saveAs }] = await Promise.all([
        import("html-to-image"),
        import("jszip").then((m) => m.default),
        import("file-saver"),
      ]);
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const node = slideRefs.current[i];
        if (!node) continue;
        const dataUrl = await toPng(node, {
          pixelRatio: 1.5,
          cacheBust: true,
          backgroundColor: "#0a0a0a",
          width: POSTER_W,
          height: POSTER_H,
        });
        // dataUrl 形如 "data:image/png;base64,..."
        const base64 = dataUrl.split(",")[1];
        zip.file(slideFileName(slides[i], i), base64, { base64: true });
        setProgress({ done: i + 1, total: slides.length });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const tickerHint = inferFileNameSuffix(data);
      const zipName = `${fileNamePrefix}${tickerHint ? "_" + tickerHint : ""}_${Date.now()}.zip`;
      saveAs(blob, zipName);
    } catch (err) {
      console.error("[share-poster] download failed:", err);
      setError(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }, [slides, data, fileNamePrefix]);

  const buttonNode =
    variant === "button" ? (
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 rounded-sm border border-border px-2.5 py-1 text-[12px] text-foreground-soft transition hover:border-accent hover:text-accent-strong ${className}`}
        title="生成分享图集"
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
        title="生成分享图集"
        aria-label="生成分享图集"
      >
        <Share2 size={variant === "icon-compact" ? 13 : 15} />
      </button>
    );

  return (
    <>
      {buttonNode}

      {open && resolvedUrl && slides.length > 0 ? (
        <>
          {/* 隐藏的全尺寸渲染区：用于 html-to-image 截图。位移到屏幕外，但 visibility 保持 visible */}
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: -99999,
              top: 0,
              pointerEvents: "none",
              width: POSTER_W,
              // 多个 slide 垂直堆叠
              display: "flex",
              flexDirection: "column",
            }}
          >
            {slides.map((slide, i) => (
              <div
                key={i}
                id={`slide-${i}`}
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
                style={{ width: POSTER_W, height: POSTER_H, flexShrink: 0 }}
              >
                <SlideContent slide={slide} />
              </div>
            ))}
          </div>

          {/* Dialog overlay */}
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={handleClose}
          >
            <div
              className="relative flex max-h-[94vh] w-full max-w-[560px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div>
                  <p className="text-[12px] font-semibold">小红书图集预览</p>
                  <p className="text-[10px] text-muted">
                    {slides.length} 张 · 1080×1440 · 适配小红书 / 微博 / 朋友圈
                  </p>
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

              {/* Carousel */}
              <div className="relative flex-1 overflow-hidden bg-[#0a0a0a]">
                {/* Visible scaled preview viewport */}
                <div
                  className="mx-auto"
                  style={{
                    width: POSTER_W * PREVIEW_SCALE,
                    height: POSTER_H * PREVIEW_SCALE,
                    marginTop: 16,
                    marginBottom: 16,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${PREVIEW_SCALE})`,
                      transformOrigin: "top left",
                      width: POSTER_W,
                      height: POSTER_H,
                    }}
                  >
                    <SlideContent slide={slides[carouselIndex]} />
                  </div>
                </div>

                {/* Prev / Next */}
                {slides.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setCarouselIndex((i) => Math.max(i - 1, 0))}
                      disabled={carouselIndex === 0}
                      className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="上一张"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCarouselIndex((i) => Math.min(i + 1, slides.length - 1))
                      }
                      disabled={carouselIndex === slides.length - 1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="下一张"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                ) : null}
              </div>

              {/* Dots indicator */}
              {slides.length > 1 ? (
                <div className="flex items-center justify-center gap-1.5 border-t border-border bg-[#0a0a0a] py-2">
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCarouselIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === carouselIndex
                          ? "w-6 bg-accent-strong"
                          : "w-1.5 bg-white/30 hover:bg-white/50"
                      }`}
                      aria-label={`第 ${i + 1} 张`}
                    />
                  ))}
                </div>
              ) : null}

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
                <p className="min-w-0 flex-1 truncate text-[11px] text-muted">
                  {error ? (
                    <span className="text-[color:var(--danger)]">{error}</span>
                  ) : saving && progress ? (
                    <>正在生成 {progress.done} / {progress.total}...</>
                  ) : (
                    <>
                      第 <span className="font-mono font-semibold">{carouselIndex + 1}</span> /{" "}
                      <span className="font-mono">{slides.length}</span> 张 · 保存为 ZIP 可一次发完
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-sm bg-[color:var(--accent-strong)] px-4 py-1.5 text-[12px] font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                  style={{
                    background: "#c9a15a",
                    color: "#0a0a0a",
                  }}
                >
                  {saving ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {saving ? "生成中..." : "一键保存全部"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function inferFileNameSuffix(data: ShareData): string {
  if (data.type === "pick") return data.symbol;
  return data.tickers?.[0] ?? "";
}
