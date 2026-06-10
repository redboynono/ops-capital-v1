import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import type { Locale } from "@/lib/i18n/locale";
import { layerLocalized, type ValueChainLayer } from "@/lib/marketing/ai-value-chain";
import type { LayerLinkage } from "@/lib/marketing/value-chain-data";

const layerTints = [
  "#e8e4dc",
  "#ebe6dd",
  "#efe9df",
  "#f2ede4",
  "#f5f0e8",
  "#f8f3ec",
];

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
  locale: Locale;
  dict: Dictionary;
};

export function ValueChainStack({ layers, linkage, theme, locale, dict }: Props) {
  const ordered = [...layers].reverse();
  const vc = dict.valueChain;

  return (
    <div className="space-y-3">
      {ordered.map((layer, i) => {
        const depth = layers.length - 1 - i;
        const tint = layerTints[depth] ?? theme.bg;
        const data = linkage[layer.id];
        const text = layerLocalized(layer, locale);

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
                  {text.role}
                </p>
              </div>

              <div>
                <h3 className="text-lg md:text-xl" style={{ letterSpacing: "-0.01em" }}>
                  {text.name}
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  {layer.representatives.map((rep) => {
                    const sym = rep.symbol?.toUpperCase();
                    const rated = sym ? data?.symbols.find((s) => s.symbol === sym) : null;
                    const verdictKey = rated?.ops_verdict;
                    const verdictLabel =
                      verdictKey && verdictKey in vc.verdict
                        ? vc.verdict[verdictKey as keyof typeof vc.verdict]
                        : null;
                    const verdictBg =
                      verdictKey === "STRONG_BUY"
                        ? "#166534"
                        : verdictKey === "BUY"
                          ? "#15803d"
                          : verdictKey === "HOLD"
                            ? "#92702a"
                            : verdictKey === "SELL"
                              ? "#b91c1c"
                              : verdictKey === "STRONG_SELL"
                                ? "#7f1d1d"
                                : null;

                    const chip = (
                      <>
                        {rep.name}
                        {sym ? <span className="ml-1 font-mono opacity-60">{sym}</span> : null}
                        {verdictLabel && verdictBg ? (
                          <span
                            className="ml-1.5 inline-block rounded px-1 py-px text-[10px] font-semibold text-white"
                            style={{ background: verdictBg }}
                          >
                            {verdictLabel}
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
                    {vc.trendLabel}
                  </span>
                  {text.trend}
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
                        {fmt(vc.analysisCountFmt, { n: data.analysisCount })}
                      </Link>
                    ) : (
                      <span>{vc.noAnalysis}</span>
                    )}
                    {data.newsCount > 0 ? (
                      <Link
                        href={`/news?layer=${layer.id}`}
                        className="transition-opacity hover:opacity-70"
                        style={{ color: theme.inkSoft }}
                      >
                        {fmt(vc.newsCountFmt, { n: data.newsCount })}
                      </Link>
                    ) : null}
                    {data.compareSymbols.length >= 2 ? (
                      <Link
                        href={`/compare?symbols=${data.compareSymbols.join(",")}`}
                        className="transition-opacity hover:opacity-70"
                        style={{ color: theme.gold }}
                      >
                        {vc.compare}
                      </Link>
                    ) : null}
                    {data.latestAnalysis ? (
                      <Link
                        href={`/analysis/${data.latestAnalysis.slug}`}
                        className="max-w-full truncate transition-opacity hover:opacity-70"
                        style={{ color: theme.inkSoft }}
                        title={data.latestAnalysis.title}
                      >
                        {fmt(vc.latestFmt, { title: data.latestAnalysis.title })}
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
        {vc.footer}
      </p>
    </div>
  );
}
