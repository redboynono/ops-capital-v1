import type { TradeIdea } from "@/lib/option-trade-ideas";
import { analyzeIdeaPayoff, payoffAtPrice, type IdeaPayoffAnalysis } from "@/lib/idea-payoff";

function fmtUsd(n: number | null, opts?: { signed?: boolean }): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n).toFixed(2);
  if (opts?.signed) {
    if (n > 0) return `+$${abs}`;
    if (n < 0) return `-$${abs}`;
    return "$0.00";
  }
  return `$${abs}`;
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function PayoffChart({
  analysis,
  idea,
  accent,
}: {
  analysis: IdeaPayoffAnalysis;
  idea: TradeIdea;
  accent: string;
}) {
  const vbW = 100;
  const vbH = 44;
  const padX = 6;
  const padY = 5;
  const { curve, priceMin, priceMax, plMin, plMax, spot } = analysis;
  const plRange = plMax - plMin || 1;
  const priceRange = priceMax - priceMin || 1;

  const x = (price: number) => padX + ((vbW - 2 * padX) * (price - priceMin)) / priceRange;
  const y = (pl: number) => padY + (vbH - 2 * padY) * (1 - (pl - plMin) / plRange);

  let path = "";
  curve.forEach((pt, i) => {
    const cmd = i === 0 ? "M" : "L";
    path += `${cmd} ${x(pt.price).toFixed(2)} ${y(pt.pl).toFixed(2)} `;
  });

  const zeroY = y(0);
  const spotX = spot != null ? x(spot) : null;
  const spotPl =
    spot != null ? payoffAtPrice(spot, idea.legs, idea.netPremium) : null;
  const spotY = spotPl != null ? y(spotPl) : null;

  return (
    <div className="rounded-md border border-border bg-surface-muted/50 p-2">
      <div className="mb-1 flex items-center justify-between text-[9px] text-muted">
        <span>到期盈亏（$/股）</span>
        <span className="font-mono">
          股价 {priceMin.toFixed(0)} – {priceMax.toFixed(0)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="none"
        className="h-[120px] w-full"
        aria-label="到期盈亏曲线"
      >
        <line
          x1={padX}
          y1={zeroY}
          x2={vbW - padX}
          y2={zeroY}
          stroke="var(--border)"
          strokeWidth={0.4}
          strokeDasharray="2 2"
        />
        {spotX != null ? (
          <line
            x1={spotX}
            y1={padY}
            x2={spotX}
            y2={vbH - padY}
            stroke={accent}
            strokeWidth={0.5}
            opacity={0.7}
          />
        ) : null}
        <path
          d={path.trim()}
          fill="none"
          stroke={accent}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
        {spotX != null && spotY != null ? (
          <circle cx={spotX} cy={spotY} r={1.8} fill={accent} />
        ) : null}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-muted">
        <span>最大亏 {fmtUsd(analysis.maxLoss, { signed: true })}</span>
        {spot != null && spotPl != null ? (
          <span style={{ color: accent }}>
            现价盈亏 {fmtUsd(spotPl, { signed: true })}
          </span>
        ) : (
          <span style={{ color: accent }}>现价</span>
        )}
        <span>最大盈 {fmtUsd(analysis.maxGain, { signed: true })}</span>
      </div>
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-surface px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 font-mono text-[13px] font-bold text-foreground">{value}</p>
      {sub ? <p className="mt-0.5 text-[9px] text-muted-soft">{sub}</p> : null}
    </div>
  );
}

export function IdeaPayoffAnalyzer({
  idea,
  spot,
  accent,
}: {
  idea: TradeIdea;
  spot: number | null;
  accent: string;
}) {
  if (idea.netPremium == null) {
    return (
      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] text-muted">权利金数据不足，暂无法计算收益分析。</p>
      </div>
    );
  }

  const a = analyzeIdeaPayoff(idea, spot);
  const beLabel =
    a.breakevens.length === 0
      ? "—"
      : a.breakevens.map((b) => `$${b.toFixed(2)}`).join(" / ");

  const cushionLabel = idea.isCredit
    ? idea.kind === "bear_call_spread"
      ? "上方缓冲"
      : idea.kind === "bull_put_spread"
        ? "下方缓冲"
        : "区间缓冲"
    : idea.kind === "long_call"
      ? "至盈亏平衡"
      : "至盈亏平衡";

  const cushionVal =
    idea.kind === "bear_call_spread" || idea.kind === "long_call"
      ? fmtPct(a.cushionUpPct)
      : idea.kind === "bull_put_spread" || idea.kind === "long_put"
        ? fmtPct(a.cushionDownPct)
        : a.cushionUpPct != null && a.cushionDownPct != null
          ? `↑${fmtPct(a.cushionUpPct)} ↓${fmtPct(a.cushionDownPct)}`
          : "—";

  const yieldFlat =
    idea.isCredit && spot != null && idea.netPremium != null && spot > 0
      ? `${((idea.netPremium / spot) * 100).toFixed(1)}%`
      : null;

  return (
    <div className="border-t border-border bg-surface-muted/30">
      <div className="px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          收益分析 · 到期盈亏
        </p>
        <p className="mt-0.5 text-[10px] text-muted-soft">
          基于 Idea 腿 VWAP 估算权利金；非历史回测胜率。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-3 sm:grid-cols-4">
        <StatCell label="盈亏平衡" value={beLabel} />
        <StatCell
          label={idea.isCredit ? "最大盈利" : "理论最大盈"}
          value={fmtUsd(a.maxGain, { signed: true })}
          sub={idea.isCredit ? "股价落在盈利区" : undefined}
        />
        <StatCell label="最大亏损" value={fmtUsd(a.maxLoss, { signed: true })} />
        <StatCell label={cushionLabel} value={cushionVal} sub={yieldFlat ? `平价收益 ${yieldFlat}` : undefined} />
      </div>

      <div className="px-4 pb-4">
        <PayoffChart analysis={a} idea={idea} accent={accent} />
      </div>
    </div>
  );
}
