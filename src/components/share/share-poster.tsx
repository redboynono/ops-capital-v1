"use client";

/**
 * 单张幻灯片的视觉渲染：1080×1440 暗黑金融终端风。
 * 由 share-slides.ts 的 Slide 联合类型驱动，全部 inline style 以保证 html-to-image 可靠捕获。
 */

import { QRCodeSVG } from "qrcode.react";
import type { CSSProperties } from "react";
import type { Slide } from "./share-slides";

const W = 1080;
const H = 1440;

const C = {
  ink: "#0a0a0a",
  inkSoft: "#141414",
  inkPanel: "#0d0c0a",
  border: "#2a2620",
  borderStrong: "#3a342a",
  text: "#f3ede0",
  textDim: "#d9d0bd",
  muted: "#9a9284",
  mutedSoft: "#7a7468",
  gold: "#c9a15a",
  goldSoft: "#8c7142",
  success: "#36c26a",
  danger: "#e0516e",
};

const FONT_SANS =
  '"PingFang SC", "Noto Sans SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Arial, sans-serif';
const FONT_MONO =
  '"JetBrains Mono", "SF Mono", "Roboto Mono", Menlo, Consolas, monospace';

const baseStyle: CSSProperties = {
  width: W,
  height: H,
  background: `radial-gradient(ellipse at 18% 0%, #1a1610 0%, ${C.ink} 60%), ${C.ink}`,
  color: C.text,
  fontFamily: FONT_SANS,
  position: "relative",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
};

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
function pctColor(n: number | null | undefined): string {
  if (n == null) return C.muted;
  if (n > 0) return C.success;
  if (n < 0) return C.danger;
  return C.text;
}

/** 顶部 brand 条，所有 slide 共用 */
function BrandBar({ label, right }: { label: string; right?: string }) {
  return (
    <div
      style={{
        padding: "52px 72px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ color: C.gold, fontSize: 36 }}>◆</span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "0.24em",
            color: C.text,
          }}
        >
          {label}
        </span>
      </div>
      {right ? (
        <span style={{ fontSize: 16, color: C.muted, letterSpacing: "0.08em" }}>{right}</span>
      ) : null}
    </div>
  );
}

/** 底部金色细线 + 页码标签 */
function FooterStrip({ pageInfo, hint }: { pageInfo?: string; hint?: string }) {
  return (
    <div
      style={{
        padding: "0 72px 52px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          height: 2,
          flex: 1,
          background: `linear-gradient(90deg, ${C.goldSoft}, transparent 80%)`,
        }}
      />
      <span
        style={{
          marginLeft: 20,
          fontSize: 14,
          letterSpacing: "0.32em",
          color: C.gold,
          fontWeight: 700,
        }}
      >
        {hint ?? "继续滑动 →"}
      </span>
      {pageInfo ? (
        <span
          style={{
            marginLeft: 20,
            fontSize: 14,
            letterSpacing: "0.16em",
            color: C.muted,
            fontFamily: FONT_MONO,
            fontWeight: 600,
          }}
        >
          {pageInfo}
        </span>
      ) : null}
    </div>
  );
}

function GoldGlow() {
  return (
    <div
      style={{
        position: "absolute",
        top: -240,
        right: -240,
        width: 700,
        height: 700,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${C.gold}1f 0%, transparent 60%)`,
        pointerEvents: "none",
      }}
    />
  );
}

/* =========================================================================
 * Slide variants
 * ======================================================================= */

function PostCover({ slide }: { slide: Extract<Slide, { kind: "post-cover" }> }) {
  return (
    <div style={baseStyle}>
      <GoldGlow />
      <BrandBar label={slide.brand} right={slide.meta} />

      <div
        style={{
          padding: "120px 72px 40px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 56,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: C.ink,
              background: C.gold,
              padding: "10px 22px",
            }}
          >
            {slide.kindLabel}
          </span>
          {slide.tickers.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: 22,
                fontFamily: FONT_MONO,
                fontWeight: 700,
                color: C.gold,
                border: `1.5px solid ${C.goldSoft}`,
                padding: "8px 18px",
                letterSpacing: "0.06em",
              }}
            >
              {t}
            </span>
          ))}
        </div>

        <h1
          style={{
            fontSize: slide.title.length > 28 ? 76 : 92,
            fontWeight: 900,
            lineHeight: 1.18,
            letterSpacing: "0.005em",
            color: C.text,
            margin: 0,
          }}
        >
          {slide.title}
        </h1>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            color: C.muted,
            fontSize: 18,
            letterSpacing: "0.08em",
          }}
        >
          <span style={{ height: 1, width: 60, background: C.goldSoft }} />
          <span style={{ color: C.gold, fontWeight: 700, letterSpacing: "0.32em" }}>
            RESEARCH · DISCIPLINE · ALPHA
          </span>
        </div>
      </div>

      <FooterStrip hint="向右滑动查看 BLUF →" />
    </div>
  );
}

function PickCover({ slide }: { slide: Extract<Slide, { kind: "pick-cover" }> }) {
  return (
    <div style={baseStyle}>
      <GoldGlow />
      <BrandBar label={slide.brand} right="OPS PICKS" />

      <div
        style={{
          padding: "80px 72px 40px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 36,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: C.ink,
              background: C.gold,
              padding: "10px 22px",
            }}
          >
            {slide.statusLabel}
          </span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.gold,
              border: `1.5px solid ${C.goldSoft}`,
              padding: "8px 18px",
              letterSpacing: "0.1em",
            }}
          >
            {slide.convictionLabel}
          </span>
        </div>

        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 220,
            fontWeight: 900,
            lineHeight: 0.95,
            color: C.text,
            letterSpacing: "-0.03em",
          }}
        >
          {slide.symbol}
        </div>

        <h1
          style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1.25,
            color: C.text,
            margin: 0,
          }}
        >
          {slide.title}
        </h1>

        {slide.subtitle ? (
          <p
            style={{
              fontSize: 28,
              lineHeight: 1.55,
              color: C.textDim,
              margin: 0,
            }}
          >
            {slide.subtitle}
          </p>
        ) : null}
      </div>

      <FooterStrip hint="向右滑动查看仓位数据 →" />
    </div>
  );
}

function Bluf({ slide }: { slide: Extract<Slide, { kind: "bluf" }> }) {
  return (
    <div style={baseStyle}>
      <GoldGlow />
      <BrandBar label={slide.brand} right="BLUF" />

      <div
        style={{
          padding: "80px 72px 40px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span style={{ color: C.gold, fontSize: 28 }}>◆</span>
          <span
            style={{
              fontSize: 18,
              letterSpacing: "0.32em",
              color: C.gold,
              fontWeight: 800,
            }}
          >
            BOTTOM LINE UP FRONT
          </span>
        </div>

        <h2
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: C.muted,
            lineHeight: 1.3,
            margin: 0,
          }}
        >
          {slide.title}
        </h2>

        <div style={{ borderLeft: `4px solid ${C.gold}`, paddingLeft: 36 }}>
          <p
            style={{
              fontSize: 44,
              lineHeight: 1.55,
              color: C.text,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "0.005em",
            }}
          >
            {slide.bluf}
          </p>
        </div>

        {slide.tickers.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            {slide.tickers.slice(0, 5).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 20,
                  fontFamily: FONT_MONO,
                  fontWeight: 700,
                  color: C.gold,
                  border: `1.5px solid ${C.goldSoft}`,
                  padding: "8px 18px",
                  letterSpacing: "0.06em",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <FooterStrip />
    </div>
  );
}

function Stats({ slide }: { slide: Extract<Slide, { kind: "stats" }> }) {
  return (
    <div style={baseStyle}>
      <GoldGlow />
      <BrandBar label={slide.brand} right="POSITION DATA" />

      <div
        style={{
          padding: "80px 72px 40px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 60,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 130,
              fontWeight: 900,
              lineHeight: 1,
              color: C.text,
              letterSpacing: "-0.02em",
            }}
          >
            {slide.symbol}
          </span>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div
              style={{
                fontSize: 18,
                letterSpacing: "0.28em",
                color: C.muted,
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              {slide.pctLabel}
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 130,
                fontWeight: 900,
                lineHeight: 1,
                color: pctColor(slide.pct),
                letterSpacing: "-0.01em",
              }}
            >
              {fmtPct(slide.pct)}
            </div>
          </div>
        </div>

        {/* Price grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            border: `1px solid ${C.border}`,
            background: C.inkPanel,
          }}
        >
          {[
            { label: "入场价", value: fmtPrice(slide.entry), sub: slide.entryDate, color: C.text },
            {
              label: "现价",
              value: fmtPrice(slide.current),
              sub: "Live",
              color: pctColor(slide.pct),
            },
            { label: "目标价", value: fmtPrice(slide.target), sub: "Target", color: C.success },
            { label: "止损价", value: fmtPrice(slide.stop), sub: "Stop", color: C.danger },
          ].map((cell, i) => (
            <div
              key={cell.label}
              style={{
                padding: "32px 26px",
                borderRight: i < 3 ? `1px solid ${C.border}` : undefined,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: "0.26em",
                  color: C.muted,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {cell.label}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontFamily: FONT_MONO,
                  fontSize: 42,
                  fontWeight: 800,
                  color: cell.color,
                  lineHeight: 1.05,
                }}
              >
                {cell.value}
              </div>
              <div style={{ marginTop: 8, fontSize: 14, color: C.mutedSoft }}>{cell.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <FooterStrip />
    </div>
  );
}

function Body({ slide }: { slide: Extract<Slide, { kind: "body" }> }) {
  return (
    <div style={baseStyle}>
      <GoldGlow />
      <BrandBar label={slide.brand} right={slide.sectionLabel} />

      <div
        style={{
          padding: "70px 72px 40px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 44,
        }}
      >
        {slide.heading ? (
          <div>
            <div
              style={{
                fontSize: 14,
                letterSpacing: "0.32em",
                color: C.gold,
                fontWeight: 800,
                marginBottom: 18,
              }}
            >
              SECTION
            </div>
            <h2
              style={{
                fontSize: 60,
                fontWeight: 900,
                lineHeight: 1.15,
                color: C.text,
                margin: 0,
                letterSpacing: "0.005em",
              }}
            >
              {slide.heading}
            </h2>
            <div
              style={{
                marginTop: 24,
                height: 2,
                width: 120,
                background: C.gold,
              }}
            />
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 32, flex: 1 }}>
          {slide.paragraphs.map((p, i) => (
            <p
              key={i}
              style={{
                fontSize: 30,
                lineHeight: 1.7,
                color: C.textDim,
                margin: 0,
                letterSpacing: "0.005em",
              }}
            >
              {p}
            </p>
          ))}
        </div>
      </div>

      <FooterStrip pageInfo={`${slide.pageNum} / ${slide.pageTotal}`} />
    </div>
  );
}

function Cta({ slide }: { slide: Extract<Slide, { kind: "cta" }> }) {
  return (
    <div style={baseStyle}>
      <GoldGlow />
      <BrandBar label={slide.brand} />

      <div
        style={{
          padding: "120px 72px 40px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 64,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
            <span
              style={{
                fontSize: 18,
                letterSpacing: "0.32em",
                color: C.gold,
                fontWeight: 800,
              }}
            >
              SCAN TO UNLOCK
            </span>
            <h2
              style={{
                fontSize: 56,
                fontWeight: 900,
                lineHeight: 1.25,
                color: C.text,
                margin: 0,
                letterSpacing: "0.005em",
              }}
            >
              扫描二维码
              <br />
              解锁完整估值模型
              <br />
              与机构级交易纪律
            </h2>
            <span
              style={{
                fontSize: 22,
                color: C.muted,
                fontFamily: FONT_MONO,
                marginTop: 12,
                letterSpacing: "0.05em",
              }}
            >
              opscapital.com
            </span>
          </div>
          <div
            style={{
              background: C.text,
              padding: 28,
              borderRadius: 8,
              lineHeight: 0,
              flexShrink: 0,
            }}
          >
            <QRCodeSVG
              value={slide.url}
              size={300}
              level="M"
              includeMargin={false}
              fgColor={C.ink}
            />
          </div>
        </div>

        <div
          style={{
            borderTop: `1px solid ${C.border}`,
            paddingTop: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: 16,
              letterSpacing: "0.18em",
              color: C.goldSoft,
              fontWeight: 700,
            }}
          >
            RESEARCH-DRIVEN · GLOBAL TECH · DIGITAL ASSETS
          </span>
          <span style={{ fontSize: 16, color: C.mutedSoft }}>Singapore · Hong Kong</span>
        </div>
      </div>
    </div>
  );
}

/** Public: render one slide variant */
export function SlideContent({ slide }: { slide: Slide }) {
  switch (slide.kind) {
    case "post-cover":
      return <PostCover slide={slide} />;
    case "pick-cover":
      return <PickCover slide={slide} />;
    case "bluf":
      return <Bluf slide={slide} />;
    case "stats":
      return <Stats slide={slide} />;
    case "body":
      return <Body slide={slide} />;
    case "cta":
      return <Cta slide={slide} />;
  }
}
