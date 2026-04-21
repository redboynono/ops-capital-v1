import Link from "next/link";
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
          <h2 className="text-[15px] font-bold text-foreground">OPS Quant Top</h2>
          <p className="text-[11px] text-muted">按五因子加权量化评分降序 · 点击进入评级详情</p>
        </div>
        <Link href="/tickers" className="text-[12px] font-semibold text-accent-strong hover:underline">
          全部标的 →
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-muted">暂无已评级标的。</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r, i) => {
            const ops = r.ops_score ? Number(r.ops_score) : null;
            const street = r.street_score ? Number(r.street_score) : null;
            const quant = r.quant_score ? Number(r.quant_score) : null;
            return (
              <Link
                key={r.symbol}
                href={`/t/${r.symbol}`}
                className="row-hover flex items-center gap-3 px-4 py-2.5"
              >
                <span className="w-5 text-right font-mono text-[11px] text-muted-soft">{i + 1}</span>
                <div className="w-20 min-w-20">
                  <p className="font-mono text-[13px] font-bold text-accent-strong">{r.symbol}</p>
                  <p className="truncate text-[10px] text-muted">{r.industry ?? "—"}</p>
                </div>
                <p className="flex-1 truncate text-[12px] text-foreground-soft">{r.name}</p>

                {r.ops_verdict ? (
                  <span
                    className="inline-flex h-6 items-center justify-center rounded-sm px-2 font-mono text-[10px] font-bold text-white"
                    style={{ background: VERDICT_BG[r.ops_verdict] }}
                  >
                    {VERDICT_LABELS[r.ops_verdict].en}
                  </span>
                ) : null}

                <ScoreChip label="OPS" value={ops} />
                <ScoreChip label="STR" value={street} />
                <ScoreChip label="QNT" value={quant} strong />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ScoreChip({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <div className="flex w-14 flex-col items-center gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-soft">{label}</span>
      <span
        className="inline-flex h-6 w-12 items-center justify-center rounded-sm font-mono text-[11px] font-bold"
        style={{
          background: value == null ? "rgba(255,255,255,0.05)" : scoreColor(value),
          color: value == null ? "rgba(255,255,255,0.4)" : "#fff",
          border: strong && value != null ? "1px solid rgba(255,184,77,0.8)" : "none",
        }}
      >
        {value == null ? "—" : value.toFixed(2)}
      </span>
    </div>
  );
}
