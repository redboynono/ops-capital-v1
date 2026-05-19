import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title") ?? "OPS Alpha";
  const subtitle = req.nextUrl.searchParams.get("subtitle") ?? "AI 驱动的中文投研终端";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "linear-gradient(145deg, #0a0a0d 0%, #1a1410 55%, #0a0a0d 100%)",
          color: "#f5f1ea",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              background: "#ff9900",
              color: "#0a0a0d",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            α
          </div>
          <span style={{ fontSize: 22, letterSpacing: 4, color: "#ff9900", fontWeight: 700 }}>
            OPS ALPHA
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1000 }}>
          <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1 }}>{title}</div>
          <div style={{ fontSize: 24, color: "#c4b8a8", lineHeight: 1.4 }}>{subtitle}</div>
        </div>
        <div style={{ fontSize: 18, color: "#6b5c3f" }}>opscapital.com · AI Research Terminal</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
