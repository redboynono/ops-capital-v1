import Link from "next/link";
import { IdeaPayoffAnalyzer } from "@/components/idea-payoff-analyzer";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";
import { buildOptionTradeIdeas, type IdeaLeg, type TradeIdea } from "@/lib/option-trade-ideas";

const ACCENT: Record<TradeIdea["accent"], { border: string; title: string; ring: string }> = {
  green: {
    border: "border-t-[#16a34a]",
    title: "text-[#15803d] dark:text-[#4ade80]",
    ring: "#16a34a",
  },
  red: {
    border: "border-t-[#dc2626]",
    title: "text-[#b91c1c] dark:text-[#f87171]",
    ring: "#dc2626",
  },
  amber: {
    border: "border-t-[#d97706]",
    title: "text-[#b45309] dark:text-[#fbbf24]",
    ring: "#d97706",
  },
  blue: {
    border: "border-t-[#2563eb]",
    title: "text-[#1d4ed8] dark:text-[#60a5fa]",
    ring: "#2563eb",
  },
};

function FlowRing({ score, color }: { score: number; color: string }) {
  const deg = Math.min(360, Math.round((score / 100) * 360));
  return (
    <div className="relative mx-auto h-[72px] w-[72px]">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${color} ${deg}deg, var(--border) ${deg}deg)`,
        }}
      />
      <div className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full bg-surface">
        <span className="font-mono text-[18px] font-bold text-foreground">{score}</span>
        <span className="text-[9px] text-muted">流向匹配</span>
      </div>
    </div>
  );
}

function LegAction({ leg }: { leg: IdeaLeg }) {
  const isCall = leg.contractType === "call";
  const actionZh = leg.action === "buy" ? "买入" : "卖出";
  const typeZh = isCall ? "CALL" : "PUT";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
        isCall
          ? "bg-[color:color-mix(in_srgb,#16a34a_20%,transparent)] text-[#15803d] dark:text-[#86efac]"
          : "bg-[color:color-mix(in_srgb,#dc2626_20%,transparent)] text-[#b91c1c] dark:text-[#fca5a5]"
      }`}
    >
      {actionZh} {typeZh}
    </span>
  );
}

function IdeaCard({
  idea,
  symbol,
  week,
  spot,
}: {
  idea: TradeIdea;
  symbol: string;
  week: "this" | "next";
  spot: number | null;
}) {
  const a = ACCENT[idea.accent];
  const premLabel = idea.isCredit ? "预估净权利金" : "预估净成本";
  const premVal =
    idea.netPremium != null
      ? `$${Math.abs(idea.netPremium).toFixed(2)}`
      : "—";

  return (
    <article className={`card flex flex-col overflow-hidden border-t-4 ${a.border}`}>
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              OPS Alpha · Trade Idea
            </p>
            <h3 className={`mt-0.5 text-[16px] font-bold ${a.title}`}>{idea.titleZh}</h3>
            <p className="font-mono text-[11px] text-muted">{idea.title}</p>
          </div>
          <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent-strong">
            {idea.confidence}置信
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted">{idea.flowNote}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <div className="text-center">
          <p className="label-caps text-[10px]">{premLabel}</p>
          <p className="mt-1 font-mono text-[20px] font-bold text-foreground">{premVal}</p>
          {idea.spreadWidth != null ? (
            <p className="text-[10px] text-muted">价差宽度 {idea.spreadWidth}</p>
          ) : null}
        </div>
        <FlowRing score={idea.flowScore} color={a.ring} />
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] font-semibold text-foreground-soft">OPS Alpha 推荐</p>
        <p className="mt-1 text-[12px] leading-relaxed text-foreground">{idea.opsAlphaRec}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{idea.rationale}</p>
      </div>

      <IdeaPayoffAnalyzer idea={idea} spot={spot} accent={a.ring} />

      <div className="mt-auto border-t border-border">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="bg-surface-muted text-[10px] uppercase text-muted">
              <th className="px-3 py-1.5">到期</th>
              <th className="px-3 py-1.5">行权价</th>
              <th className="px-3 py-1.5">操作</th>
            </tr>
          </thead>
          <tbody>
            {idea.legs.map((l, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-foreground-soft">{l.expirationDate}</td>
                <td className="px-3 py-2 font-mono font-bold text-foreground">{l.strike}</td>
                <td className="px-3 py-2">
                  <LegAction leg={l} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-3 py-2 text-[10px] text-muted-soft">
          <Link
            href={`/expiring-options?symbol=${symbol}&week=${week}#option-chain`}
            className="font-semibold text-accent-strong hover:underline"
          >
            查看完整期权链 →
          </Link>
        </p>
      </div>
    </article>
  );
}

export async function OptionTradeIdeasPanel({
  symbol,
  expirationDate,
  expiryLabel,
  week = "this",
}: {
  symbol: string;
  expirationDate: string;
  expiryLabel: string;
  week?: "this" | "next";
}) {
  const data = await buildOptionTradeIdeas({ symbol, expirationDate, maxIdeas: 3 });

  return (
    <section className="mb-5">
      <header className="mb-3">
        <span className="label-caps">{OPTION_ALPHA.labelCaps}</span>
        <h2 className="mt-1 text-[18px] font-bold text-foreground">
          <span className="font-mono text-accent-strong">{data.symbol}</span> 期权交易 Idea
        </h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted">
          基于<strong className="text-foreground-soft">{expiryLabel}</strong>（{data.expirationDate}
          ）真实成交与标的现价 ${data.spot?.toFixed(2) ?? "—"} 自动组合价差/铁鹰/单腿方案。
          比传统「历史胜率」更透明：用<strong className="text-foreground-soft">流向匹配分</strong>
          表示结构与当日多空成交是否一致（非回测胜率）。
        </p>
      </header>

      {data.ideas.length === 0 ? (
        <div className="card p-6 text-center text-[13px] text-muted">
          该到期日链上数据不足，无法生成结构化 Idea。请切换「下周五」或换 SPY/QQQ。
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              symbol={data.symbol}
              week={week}
              spot={data.spot}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted-soft">
        权利金为 VWAP 粗算，下单前以券商买卖价为准。结构化期权风险极高，仅供研究，不构成投资建议。
      </p>
    </section>
  );
}
