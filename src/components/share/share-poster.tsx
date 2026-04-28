"use client";

import { QRCodeSVG } from "qrcode.react";
import { forwardRef } from "react";

/**
 * 小红书竖版分享海报：1080 × 1440 (3:4)
 * 两种内容类型：post（文章/快讯）、pick（OPS Picks 荐股）
 */

export type PostPoster = {
  type: "post";
  kind: "analysis" | "news";
  title: string;
  excerpt?: string | null;
  tickers?: string[];
  createdAt?: string;
  url: string;
};

export type PickPoster = {
  type: "pick";
  symbol: string;
  title: string;
  subtitle?: string | null;
  conviction?: "high" | "medium" | "low";
  status: "open" | "closed" | "stopped";
  unrealizedPct?: number | null;
  realizedPct?: number | null;
  entryPrice: number;
  entryDate: string;
  targetPrice?: number | null;
  stopPrice?: number | null;
  currentPrice?: number | null;
  url: string;
};

export type PosterData = PostPoster | PickPoster;

const GOLD = "#c9a15a";
const GOLD_SOFT = "#8c7142";
const INK = "#0a0a0a";
const INK_SOFT = "#141414";
const BORDER = "#2a2620";
const TEXT = "#f3ede0";
const MUTED = "#9a9284";
const SUCCESS = "#36c26a";
const DANGER = "#e0516e";

function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function fmtPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}
function returnColor(n: number | null | undefined): string {
  if (n == null) return MUTED;
  if (n > 0) return SUCCESS;
  if (n < 0) return DANGER;
  return TEXT;
}

export const SharePoster = forwardRef<HTMLDivElement, { data: PosterData }>(function SharePoster(
  { data },
  ref,
) {
  const timestamp = new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1440,
        background: `radial-gradient(ellipse at 20% 0%, #1a1610 0%, ${INK} 55%), ${INK}`,
        color: TEXT,
        fontFamily:
          '"PingFang SC", "Noto Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* subtle gold glow */}
      <div
        style={{
          position: "absolute",
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD}22 0%, transparent 60%)`,
          pointerEvents: "none",
        }}
      />

      {/* Top bar */}
      <header
        style={{
          padding: "60px 72px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ color: GOLD, fontSize: 44 }}>◆</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: "0.22em",
                color: TEXT,
              }}
            >
              OPS ALPHA TERMINAL
            </span>
            <span
              style={{
                fontSize: 16,
                letterSpacing: "0.3em",
                color: GOLD_SOFT,
                fontWeight: 600,
              }}
            >
              RESEARCH · DISCIPLINE · ALPHA
            </span>
          </div>
        </div>
        <span style={{ fontSize: 18, color: MUTED, letterSpacing: "0.08em" }}>{timestamp}</span>
      </header>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          padding: "80px 72px 40px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          zIndex: 1,
        }}
      >
        {data.type === "post" ? <PostBody data={data} /> : <PickBody data={data} />}
      </main>

      {/* Bottom CTA + QR */}
      <footer
        style={{
          borderTop: `1px solid ${BORDER}`,
          background: INK_SOFT,
          padding: "48px 72px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 40,
          zIndex: 1,
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <span
            style={{
              fontSize: 14,
              letterSpacing: "0.32em",
              color: GOLD,
              fontWeight: 700,
            }}
          >
            SCAN TO UNLOCK
          </span>
          <span
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: TEXT,
              lineHeight: 1.3,
              letterSpacing: "0.01em",
            }}
          >
            扫描二维码
            <br />
            解锁机构级超额收益
          </span>
          <span style={{ fontSize: 16, color: MUTED, marginTop: 6 }}>opscapital.com</span>
        </div>
        <div
          style={{
            background: TEXT,
            padding: 18,
            borderRadius: 8,
            lineHeight: 0,
          }}
        >
          <QRCodeSVG value={data.url} size={180} level="M" includeMargin={false} fgColor={INK} />
        </div>
      </footer>
    </div>
  );
});

function PostBody({ data }: { data: PostPoster }) {
  const label = data.kind === "analysis" ? "深度研报" : "市场快讯";
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: INK,
            background: GOLD,
            padding: "8px 18px",
            borderRadius: 2,
          }}
        >
          {label}
        </span>
        {data.tickers?.slice(0, 4).map((t) => (
          <span
            key={t}
            style={{
              fontSize: 20,
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
              fontWeight: 700,
              color: GOLD,
              border: `1.5px solid ${GOLD_SOFT}`,
              padding: "6px 14px",
              borderRadius: 2,
              letterSpacing: "0.05em",
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <h1
        style={{
          marginTop: 44,
          fontSize: data.title.length > 30 ? 60 : 72,
          fontWeight: 900,
          lineHeight: 1.22,
          letterSpacing: "0.01em",
          color: TEXT,
        }}
      >
        {data.title}
      </h1>
      {data.excerpt ? (
        <div style={{ marginTop: 52, borderLeft: `4px solid ${GOLD}`, paddingLeft: 28 }}>
          <span
            style={{
              display: "block",
              fontSize: 14,
              letterSpacing: "0.32em",
              color: GOLD,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            BLUF · BOTTOM LINE UP FRONT
          </span>
          <p
            style={{
              fontSize: 30,
              lineHeight: 1.65,
              color: "#d9d0bd",
              // 限制到约 4 行
              display: "-webkit-box",
              WebkitLineClamp: 5,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {data.excerpt}
          </p>
        </div>
      ) : null}
    </>
  );
}

function PickBody({ data }: { data: PickPoster }) {
  const displayPct = data.status === "open" ? data.unrealizedPct : data.realizedPct;
  const pctLabel = data.status === "open" ? "浮动收益" : "实现收益";
  const convictionLabel =
    data.conviction === "high" ? "高信念" : data.conviction === "low" ? "低信念" : "中等信念";

  return (
    <>
      {/* Ticker header */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: INK,
            background: GOLD,
            padding: "8px 18px",
            borderRadius: 2,
          }}
        >
          OPS PICKS
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: GOLD,
            border: `1.5px solid ${GOLD_SOFT}`,
            padding: "6px 14px",
            letterSpacing: "0.08em",
          }}
        >
          {convictionLabel}
        </span>
      </div>

      {/* Ticker + Return hero */}
      <div style={{ marginTop: 40, display: "flex", alignItems: "flex-end", gap: 40 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
              fontSize: 140,
              fontWeight: 900,
              lineHeight: 1,
              color: TEXT,
              letterSpacing: "-0.02em",
            }}
          >
            {data.symbol}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 16,
              letterSpacing: "0.28em",
              color: MUTED,
              fontWeight: 600,
              marginBottom: 10,
            }}
          >
            {pctLabel}
          </div>
          <div
            style={{
              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
              fontSize: 110,
              fontWeight: 900,
              lineHeight: 1,
              color: returnColor(displayPct),
              letterSpacing: "-0.01em",
            }}
          >
            {fmtPct(displayPct)}
          </div>
        </div>
      </div>

      {/* Title */}
      <h1
        style={{
          marginTop: 40,
          fontSize: 44,
          fontWeight: 800,
          lineHeight: 1.3,
          color: TEXT,
        }}
      >
        {data.title}
      </h1>

      {/* Price grid */}
      <div
        style={{
          marginTop: 56,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          border: `1px solid ${BORDER}`,
          background: "#0d0c0a",
        }}
      >
        {[
          { label: "入场价", value: fmtPrice(data.entryPrice), sub: data.entryDate },
          {
            label: "现价",
            value: fmtPrice(data.currentPrice),
            sub: "Live",
            accent: returnColor(displayPct),
          },
          { label: "目标价", value: fmtPrice(data.targetPrice), sub: "Target" },
          { label: "止损价", value: fmtPrice(data.stopPrice), sub: "Stop", accent: DANGER },
        ].map((cell, i) => (
          <div
            key={cell.label}
            style={{
              padding: "28px 24px",
              borderRight: i < 3 ? `1px solid ${BORDER}` : undefined,
            }}
          >
            <div
              style={{
                fontSize: 14,
                letterSpacing: "0.24em",
                color: MUTED,
                fontWeight: 600,
                textTransform: "uppercase",
              }}
            >
              {cell.label}
            </div>
            <div
              style={{
                marginTop: 10,
                fontFamily: '"JetBrains Mono", "SF Mono", monospace',
                fontSize: 38,
                fontWeight: 800,
                color: cell.accent ?? TEXT,
                lineHeight: 1.1,
              }}
            >
              {cell.value}
            </div>
            <div style={{ marginTop: 6, fontSize: 14, color: MUTED }}>{cell.sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
