import {
  CORE_FACTORS,
  DIVIDEND_FACTORS,
  FACTOR_LABELS,
  VERDICT_LABELS,
  type FactorKey,
  type Grade,
  type RatingRow,
  type Verdict,
  getFactorGrades,
  getRating,
} from "@/lib/ratings";

// -------- color palettes --------

const GRADE_BG: Record<Grade, string> = {
  "A+": "#166534", "A": "#15803d", "A-": "#16a34a",
  "B+": "#22c55e", "B": "#84cc16", "B-": "#a3a500",
  "C+": "#eab308", "C": "#ca8a04", "C-": "#d97706",
  "D+": "#ea580c", "D": "#dc2626", "D-": "#b91c1c",
  "F":  "#7f1d1d",
};
const GRADE_FG: Record<Grade, string> = {
  "A+": "#fff", "A": "#fff", "A-": "#fff",
  "B+": "#0a0a0d", "B": "#0a0a0d", "B-": "#0a0a0d",
  "C+": "#0a0a0d", "C": "#fff", "C-": "#fff",
  "D+": "#fff", "D": "#fff", "D-": "#fff",
  "F":  "#fff",
};

const VERDICT_BG: Record<Verdict, string> = {
  STRONG_BUY:  "#166534",
  BUY:         "#15803d",
  HOLD:        "#ca8a04",
  SELL:        "#dc2626",
  STRONG_SELL: "#7f1d1d",
};

// -------- small primitives --------

function GradeCell({ g, dim = false }: { g: Grade | null; dim?: boolean }) {
  if (!g) {
    return (
      <span
        className="inline-flex h-7 w-10 items-center justify-center rounded-sm font-mono text-[12px] font-bold"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}
      >—</span>
    );
  }
  const bg = GRADE_BG[g];
  const fg = GRADE_FG[g];
  return (
    <span
      className="inline-flex h-7 w-10 items-center justify-center rounded-sm font-mono text-[12px] font-bold"
      style={{
        background: bg,
        color: fg,
        opacity: dim ? 0.5 : 1,
        boxShadow: dim ? "none" : "0 0 0 1px rgba(255,255,255,0.06)",
      }}
    >{g}</span>
  );
}

function VerdictPill({ v }: { v: Verdict | null }) {
  if (!v) {
    return (
      <span className="inline-flex h-7 items-center justify-center rounded-sm px-3 font-mono text-[11px] font-bold"
        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
        N/A
      </span>
    );
  }
  const meta = VERDICT_LABELS[v];
  return (
    <span
      className="inline-flex h-7 items-center justify-center rounded-sm px-3 font-mono text-[11px] font-bold tracking-wide"
      style={{ background: VERDICT_BG[v], color: "#fff" }}
    >{meta.en}</span>
  );
}

function ScoreBox({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="inline-flex h-7 w-12 items-center justify-center rounded-sm font-mono text-[12px]"
      style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>—</span>;
  }
  // score 1-5 -> color map
  let bg = "#ca8a04"; // yellow default
  if (value >= 4.5) bg = "#166534";
  else if (value >= 4.0) bg = "#15803d";
  else if (value >= 3.5) bg = "#65a30d";
  else if (value >= 3.0) bg = "#ca8a04";
  else if (value >= 2.0) bg = "#d97706";
  else bg = "#b91c1c";
  return (
    <span
      className="inline-flex h-7 w-12 items-center justify-center rounded-sm font-mono text-[12px] font-bold"
      style={{ background: bg, color: "#fff" }}
    >{value.toFixed(2)}</span>
  );
}

// -------- public panels --------

export async function RatingsSummary({ symbol }: { symbol: string }) {
  const r = await getRating(symbol);
  return (
    <section className="card p-3">
      <header className="flex items-center justify-between">
        <p className="label-caps">OPS Ratings</p>
        <span className="text-[10px] font-mono text-muted">
          {r?.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : "—"}
        </span>
      </header>

      <div className="mt-2 space-y-1.5">
        <RatingRowLine
          label="OPS Desk"
          verdict={r?.ops_verdict ?? null}
          score={r?.ops_score ? Number(r.ops_score) : null}
        />
        <RatingRowLine
          label="Street"
          verdict={r?.street_verdict ?? null}
          score={r?.street_score ? Number(r.street_score) : null}
        />
        <RatingRowLine
          label="OPS Quant"
          verdict={null}
          score={r?.quant_score ? Number(r.quant_score) : null}
          hideVerdict
        />
      </div>

      {(r?.ops_target_price || r?.street_target_price) ? (
        <div className="mt-3 border-t border-border pt-2 text-[11px] font-mono text-muted">
          {r?.ops_target_price ? (
            <div className="flex justify-between">
              <span>OPS 目标价</span>
              <span className="text-foreground">${Number(r.ops_target_price).toFixed(2)}</span>
            </div>
          ) : null}
          {r?.street_target_price ? (
            <div className="flex justify-between">
              <span>Street 共识目标 {r.street_analyst_count ? `(${r.street_analyst_count} 分析师)` : ""}</span>
              <span className="text-foreground">${Number(r.street_target_price).toFixed(2)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {r?.notes ? (
        <p className="mt-3 border-t border-border pt-2 text-[11px] leading-relaxed text-foreground-soft">
          {r.notes}
        </p>
      ) : null}

      {!r ? (
        <p className="py-6 text-center text-[12px] text-muted">暂无评级。</p>
      ) : null}
    </section>
  );
}

function RatingRowLine({
  label, verdict, score, hideVerdict,
}: { label: string; verdict: Verdict | null; score: number | null; hideVerdict?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-foreground-soft">{label}</span>
      <div className="flex items-center gap-1.5">
        {!hideVerdict ? <VerdictPill v={verdict} /> : null}
        <ScoreBox value={score} />
      </div>
    </div>
  );
}

export async function FactorGrades({ symbol }: { symbol: string }) {
  const map = await getFactorGrades(symbol);
  const rating = await getRating(symbol);
  const factors = CORE_FACTORS.map((f) => ({ key: f, row: map.get(f) }));
  const hasAny = factors.some((f) => f.row?.grade_now);

  return (
    <section className="card p-3">
      <p className="label-caps">Factor Grades</p>

      {hasAny ? (
        <>
          <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] items-center gap-y-1.5 text-[11px] font-mono text-muted">
            <span></span>
            <span className="w-10 text-center">Now</span>
            <span className="w-10 text-center">3M</span>
            <span className="w-10 text-center">6M</span>
          </div>
          {factors.map(({ key, row }) => (
            <div key={key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 gap-y-1 py-1 text-[12px]">
              <span className="text-foreground-soft">{FACTOR_LABELS[key]}</span>
              <GradeCell g={row?.grade_now ?? null} />
              <GradeCell g={row?.grade_3m ?? null} dim />
              <GradeCell g={row?.grade_6m ?? null} dim />
            </div>
          ))}
        </>
      ) : (
        <p className="py-6 text-center text-[12px] text-muted">暂无因子评级。</p>
      )}

      {rating?.has_dividend ? <DividendInline symbol={symbol} map={map} /> : null}
    </section>
  );
}

function DividendInline({ symbol: _symbol, map }: { symbol: string; map: Awaited<ReturnType<typeof getFactorGrades>> }) {
  const rows = DIVIDEND_FACTORS.map((f) => ({ key: f, row: map.get(f) }));
  const hasAny = rows.some((r) => r.row?.grade_now);
  if (!hasAny) return null;
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="label-caps">Dividend Grades</p>
      <div className="mt-2 grid grid-cols-[1fr_auto_auto_auto] items-center gap-y-1.5 text-[11px] font-mono text-muted">
        <span></span><span className="w-10 text-center">Now</span><span className="w-10 text-center">3M</span><span className="w-10 text-center">6M</span>
      </div>
      {rows.map(({ key, row }) => (
        <div key={key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-1.5 gap-y-1 py-1 text-[12px]">
          <span className="text-foreground-soft">{FACTOR_LABELS[key]}</span>
          <GradeCell g={row?.grade_now ?? null} />
          <GradeCell g={row?.grade_3m ?? null} dim />
          <GradeCell g={row?.grade_6m ?? null} dim />
        </div>
      ))}
    </div>
  );
}

export async function QuantRanking({ symbol }: { symbol: string }) {
  const r = await getRating(symbol);
  const rows: { label: string; num: number | null; tot: number | null }[] = [
    { label: "全市场排名", num: r?.rank_overall ?? null,  tot: r?.rank_overall_total ?? null },
    { label: "板块排名",   num: r?.rank_sector ?? null,   tot: r?.rank_sector_total ?? null  },
    { label: "行业排名",   num: r?.rank_industry ?? null, tot: r?.rank_industry_total ?? null },
  ];
  const hasAny = rows.some((x) => x.num != null);
  return (
    <section className="card p-3">
      <p className="label-caps">Quant Ranking</p>
      {r?.industry ? (
        <p className="mt-1 text-[11px] text-muted">行业：<span className="font-mono text-foreground">{r.industry}</span></p>
      ) : null}
      {hasAny ? (
        <div className="mt-2 space-y-1.5">
          {rows.map((x) => (
            <div key={x.label} className="flex items-center justify-between text-[12px]">
              <span className="text-foreground-soft">{x.label}</span>
              <span className="font-mono">
                {x.num != null ? (
                  <>
                    <span className="font-bold text-foreground">{x.num}</span>
                    {x.tot != null ? <span className="text-muted"> / {x.tot}</span> : null}
                  </>
                ) : <span className="text-muted">—</span>}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-[12px] text-muted">暂无排名数据。</p>
      )}
    </section>
  );
}

export function hasAnyRating(r: RatingRow | null) {
  if (!r) return false;
  return !!(r.ops_verdict || r.street_verdict || r.quant_score || r.ops_score);
}
