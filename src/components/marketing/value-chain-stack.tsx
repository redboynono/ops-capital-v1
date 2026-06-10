import Link from "next/link";
import type { ValueChainLayer } from "@/lib/marketing/ai-value-chain";
import type { LayerLinkage } from "@/lib/marketing/value-chain-data";

const layerTints = [
  "#e8e4dc",
  "#ebe6dd",
  "#efe9df",
  "#f2ede4",
  "#f5f0e8",
  "#f8f3ec",
];

const VERDICT_STYLE: Record<string, { bg: string; label: string }> = {
  STRONG_BUY: { bg: "#166534", label: "强买" },
  BUY: { bg: "#15803d", label: "买入" },
  HOLD: { bg: "#92702a", label: "持有" },
  SELL: { bg: "#b91c1c", label: "卖出" },
  STRONG_SELL: { bg: "#7f1d1d", label: "强卖" },
};

type Props = {
  layers: ValueChainLayer[];
  linkage: Record<string, LayerLinkage>;
  theme: {
    ink: string;
    inkSoft: string;
    muted: string;
    gold: string;
    line: string;
    bg: string;
  };
};

export function ValueChainStack({ layers, linkage, theme }: Props) {
  const ordered = [...layers].reverse();

  return (
    <div className="space-y-3">
      {ordered.map((layer, i) => {
        const depth = layers.length - 1 - i;
        const tint = layerTints[depth] ?? theme.bg;
        const data = linkage[layer.id];

        return (
          <article
            key={layer.id}
            className="group relative overflow-hidden transition-shadow hover:shadow-md"
            style={{
              background: tint,
              border: `1px solid ${theme.line}`,
            }}
          >
            <div
              className="absolute left-0 top-0 h-full w-1"
              style={{ background: theme.gold, opacity: 0.35 + depth * 0.1 }}
            />
            <div className="grid gap-4 p-5 md:grid-cols-[88px_1fr] md:gap-6 md:p-6">
              <div>
                <p
                  className="font-mono text-[11px] font-semibold tracking-[0.2em]"
                  style={{ color: theme.gold }}
                >
                  {layer.id}
                </p>
                <p className="mt-1 text-[13px] leading-snug" style={{ color: theme.muted }}>
                  {layer.roleZh}
                </p>
              </div>

              <div>
                <h3 className="text-lg md:text-xl" style={{ letterSpacing: "-0.01em" }}>
                  {layer.nameZh}
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {layer.representatives.map((rep) => {
                    const sym = rep.symbol?.toUpperCase();
                    const rated = sym ? data?.symbols.find((s) => s.symbol === sym) : null;
                    const verdict = rated?.ops_verdict ? VERDICT_STYLE[rated.ops_verdict] : null;

                    const chip = (
                      <>
                        {rep.name}
                        {sym ? <span className="ml-1 font-mono opacity-60">{sym}</span> : null}
                        {verdict ? (
                          <span
                            className="ml-1.5 inline-block rounded px-1 py-px text-[10px] font-semibold text-white"
                            style={{ background: verdict.bg }}
                          >
                            {verdict.label}
                          </span>
                        ) : null}
                      </>
                    );

                    return sym ? (
                      <Link
                        key={rep.name}
                        href={`/t/${sym}`}
                        className="px-2.5 py-1 text-[12px] transition-opacity hover:opacity-70"
                        style={{
                          background: theme.bg,
                          border: `1px solid ${theme.line}`,
                          color: theme.inkSoft,
                        }}
                      >
                        {chip}
                      </Link>
                    ) : (
                      <span
                        key={rep.name}
                        className="px-2.5 py-1 text-[12px]"
                        style={{
                          background: theme.bg,
                          border: `1px solid ${theme.line}`,
                          color: theme.inkSoft,
                        }}
                      >
                        {chip}
                      </span>
                    );
                  })}
                </div>

                <p className="mt-4 text-[13px] leading-[1.8]" style={{ color: theme.inkSoft }}>
                  <span className="font-semibold" style={{ color: theme.gold }}>
                    2026 趋势 ·{" "}
                  </span>
                  {layer.trend2026}
                </p>

                {data ? (
                  <div
                    className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-[12px]"
                    style={{ borderColor: theme.line, color: theme.muted }}
                  >
                    {data.analysisCount > 0 ? (
                      <Link
                        href={`/analysis?layer=${layer.id}`}
                        className="font-semibold transition-opacity hover:opacity-70"
                        style={{ color: theme.ink }}
                      >
                        {data.analysisCount} 篇研报 →
                      </Link>
                    ) : (
                      <span>暂无研报</span>
                    )}
                    {data.newsCount > 0 ? (
                      <Link
                        href={`/news?layer=${layer.id}`}
                        className="transition-opacity hover:opacity-70"
                        style={{ color: theme.inkSoft }}
                      >
                        {data.newsCount} 条快讯
                      </Link>
                    ) : null}
                    {data.compareSymbols.length >= 2 ? (
                      <Link
                        href={`/compare?symbols=${data.compareSymbols.join(",")}`}
                        className="transition-opacity hover:opacity-70"
                        style={{ color: theme.gold }}
                      >
                        对比标的
                      </Link>
                    ) : null}
                    {data.latestAnalysis ? (
                      <Link
                        href={`/analysis/${data.latestAnalysis.slug}`}
                        className="max-w-full truncate transition-opacity hover:opacity-70"
                        style={{ color: theme.inkSoft }}
                        title={data.latestAnalysis.title}
                      >
                        最新：{data.latestAnalysis.title}
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}

      <p className="pt-2 text-center text-[11px] tracking-[0.24em]" style={{ color: theme.muted }}>
        L5 应用层 ↑ ··· L0 制造层 ↓ · 点击标的 / 研报直达 OPS Alpha
      </p>
    </div>
  );
}
