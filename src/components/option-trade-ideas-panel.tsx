import Link from "next/link";
import { IdeaPayoffAnalyzer } from "@/components/idea-payoff-analyzer";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";
import { getDictionary, getLocale } from "@/lib/i18n";
import { fmt } from "@/lib/i18n/fmt";
import {
  buildOptionTradeIdeas,
  confidenceLabel,
  type IdeaLeg,
  type TradeIdea,
  type TradeIdeasCopy,
} from "@/lib/option-trade-ideas";

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

function FlowRing({ score, color, label }: { score: number; color: string; label: string }) {
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
        <span className="text-[9px] text-muted">{label}</span>
      </div>
    </div>
  );
}

function LegAction({ leg, ti }: { leg: IdeaLeg; ti: TradeIdeasCopy }) {
  const isCall = leg.contractType === "call";
  const actionLabel = leg.action === "buy" ? ti.legBuy : ti.legSell;
  const typeLabel = isCall ? "CALL" : "PUT";
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
        isCall
          ? "bg-[color:color-mix(in_srgb,#16a34a_20%,transparent)] text-[#15803d] dark:text-[#86efac]"
          : "bg-[color:color-mix(in_srgb,#dc2626_20%,transparent)] text-[#b91c1c] dark:text-[#fca5a5]"
      }`}
    >
      {actionLabel} {typeLabel}
    </span>
  );
}

function IdeaCard({
  idea,
  symbol,
  week,
  spot,
  ti,
}: {
  idea: TradeIdea;
  symbol: string;
  week: "this" | "next";
  spot: number | null;
  ti: TradeIdeasCopy;
}) {
  const a = ACCENT[idea.accent];
  const premLabel = idea.isCredit ? ti.premCredit : ti.premDebit;
  const premVal =
    idea.netPremium != null
      ? `$${Math.abs(idea.netPremium).toFixed(2)}`
      : "—";
  const displayTitle = ti.kindTitles[idea.kind];

  return (
    <article className={`card flex flex-col overflow-hidden border-t-4 ${a.border}`}>
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{ti.cardLabel}</p>
            <h3 className={`mt-0.5 text-[16px] font-bold ${a.title}`}>{displayTitle}</h3>
            <p className="font-mono text-[11px] text-muted">{idea.title}</p>
          </div>
          <span className="rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold text-accent-strong">
            {fmt(ti.confidenceFmt, { level: confidenceLabel(idea.confidence, ti) })}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-muted">{idea.flowNote}</p>
      </header>

      <div className="grid grid-cols-2 gap-3 px-4 py-4">
        <div className="text-center">
          <p className="label-caps text-[10px]">{premLabel}</p>
          <p className="mt-1 font-mono text-[20px] font-bold text-foreground">{premVal}</p>
          {idea.spreadWidth != null ? (
            <p className="text-[10px] text-muted">{fmt(ti.spreadWidthFmt, { width: idea.spreadWidth })}</p>
          ) : null}
        </div>
        <FlowRing score={idea.flowScore} color={a.ring} label={ti.flowMatch} />
      </div>

      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] font-semibold text-foreground-soft">{ti.opsRecLabel}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-foreground">{idea.opsAlphaRec}</p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">{idea.rationale}</p>
      </div>

      <IdeaPayoffAnalyzer idea={idea} spot={spot} accent={a.ring} labels={ti.payoff} />

      <div className="mt-auto border-t border-border">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="bg-surface-muted text-[10px] uppercase text-muted">
              <th className="px-3 py-1.5">{ti.colExpiry}</th>
              <th className="px-3 py-1.5">{ti.colStrike}</th>
              <th className="px-3 py-1.5">{ti.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {idea.legs.map((l, i) => (
              <tr key={i} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-foreground-soft">{l.expirationDate}</td>
                <td className="px-3 py-2 font-mono font-bold text-foreground">{l.strike}</td>
                <td className="px-3 py-2">
                  <LegAction leg={l} ti={ti} />
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
            {ti.viewChain}
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
  const locale = await getLocale();
  const ti = getDictionary(locale).optionsPage.tradeIdeas;
  const data = await buildOptionTradeIdeas({ symbol, expirationDate, maxIdeas: 3, copy: ti });

  return (
    <section className="mb-5">
      <header className="mb-3">
        <span className="label-caps">{OPTION_ALPHA.labelCaps}</span>
        <h2 className="mt-1 text-[18px] font-bold text-foreground">
          {fmt(ti.sectionTitleFmt, { symbol: data.symbol })}
        </h2>
        <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-muted">
          {fmt(ti.introLeadFmt, {
            expiryLabel,
            date: data.expirationDate,
            spot: data.spot?.toFixed(2) ?? "—",
          })}{" "}
          {ti.introBody}{" "}
          <span className="text-foreground-soft">{ti.introFlowNote}</span>
        </p>
      </header>

      {data.ideas.length === 0 ? (
        <div className="card p-6 text-center text-[13px] text-muted">{ti.empty}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              symbol={data.symbol}
              week={week}
              spot={data.spot}
              ti={ti}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-muted-soft">{ti.disclaimer}</p>
    </section>
  );
}
