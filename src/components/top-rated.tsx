import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n";
import { mysqlQuery } from "@/lib/mysql";
import { VERDICT_LABELS, type Verdict } from "@/lib/ratings";

type TopRow = {
  symbol: string;
  name: string;
  ops_verdict: Verdict | null;
  ops_score: string | null;
  street_score: string | null;
  quant_score: string | null;
  industry: string | null;
};

const VERDICT_BG: Record<Verdict, string> = {
  STRONG_BUY: "#166534",
  BUY: "#15803d",
  HOLD: "#ca8a04",
  SELL: "#dc2626",
  STRONG_SELL: "#7f1d1d",
};

function scoreColor(v: number | null) {
  if (v == null) return "#444";
  if (v >= 4.5) return "#166534";
  if (v >= 4.0) return "#15803d";
  if (v >= 3.5) return "#65a30d";
  if (v >= 3.0) return "#ca8a04";
  if (v >= 2.0) return "#d97706";
  return "#b91c1c";
}

export async function TopRatedPanel({ limit = 6 }: { limit?: number }) {
  const locale = await getLocale();
  const p = getDictionary(locale).panels;
  const verdictLang = locale === "en" ? "en" : "zh";

  const rows = await mysqlQuery<TopRow[]>(
    `select r.symbol, t.name, r.ops_verdict, r.ops_score, r.street_score, r.quant_score, r.industry
       from ticker_ratings r
       inner join tickers t on t.symbol = r.symbol
      where r.quant_score is not null
      order by r.quant_score desc
      limit ?`,
    [limit],
  );

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">{p.quantTopTitle}</h2>
          <p className="text-[11px] text-muted">{p.quantTopSub}</p>
        </div>
        <Link href="/tickers" className="text-[12px] font-semibold text-accent-strong hover:underline">
          {p.quantTopViewAll}
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">{p.quantTopEmpty}</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r, i) => {
            const q = r.quant_score ? Number(r.quant_score) : null;
            const verdict = r.ops_verdict;
            return (
              <Link
                key={r.symbol}
                href={`/t/${r.symbol}`}
                className="flex items-center gap-3 px-4 py-2.5 row-hover"
              >
                <span className="w-5 font-mono text-[12px] font-bold text-muted">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[14px] font-bold text-accent-strong">{r.symbol}</span>
                    {verdict ? (
                      <span
                        className="rounded-sm px-1.5 py-px font-mono text-[9px] font-bold text-white"
                        style={{ background: VERDICT_BG[verdict] }}
                      >
                        {VERDICT_LABELS[verdict][verdictLang]}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[11px] text-muted">{r.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[15px] font-bold" style={{ color: scoreColor(q) }}>
                    {q?.toFixed(2) ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted">Quant</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
