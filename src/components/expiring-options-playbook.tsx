import Link from "next/link";
import {
  buildTodayExpiringOptionsPlaybook,
  type FollowLeg,
  type PlayAction,
} from "@/lib/expiring-options-playbook";

const ACTION_STYLE: Record<
  PlayAction,
  { bg: string; border: string; text: string; label: string }
> = {
  跟涨: {
    bg: "bg-[color:color-mix(in_srgb,var(--success)_12%,transparent)]",
    border: "border-[color:var(--success)]",
    text: "text-[color:var(--success)]",
    label: "轻仓跟涨",
  },
  跟跌: {
    bg: "bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)]",
    border: "border-[color:var(--danger)]",
    text: "text-[color:var(--danger)]",
    label: "轻仓跟跌",
  },
  观望: {
    bg: "bg-surface-muted",
    border: "border-border",
    text: "text-muted",
    label: "今日观望",
  },
};

function PickCard({ leg, index }: { leg: FollowLeg; index: number }) {
  const style = ACTION_STYLE[leg.action];
  const typeZh = leg.contractType === "call" ? "看涨 Call" : "看跌 Put";

  return (
    <article
      className={`rounded-md border p-4 ${style.bg} ${style.border}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            建议 {index + 1}
          </span>
          <h3 className="mt-0.5 text-[16px] font-bold text-foreground">
            <Link href={`/t/${leg.underlying}`} className="hover:text-accent-strong">
              {leg.underlying}
            </Link>
            {leg.underlyingPrice != null ? (
              <span className="ml-2 font-mono text-[13px] font-normal text-muted">
                ${leg.underlyingPrice.toFixed(2)}
              </span>
            ) : null}
          </h3>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-[11px] font-bold ${style.text} border ${style.border}`}
        >
          {style.label}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-foreground-soft">{leg.headline}</p>

      {leg.action !== "观望" ? (
        <div className="mt-3 rounded border border-border bg-surface px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">跟单要点</p>
          <dl className="mt-1.5 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[12px]">
            <dt className="text-muted">方向</dt>
            <dd className="font-semibold text-foreground">{typeZh}</dd>
            <dt className="text-muted">行权价</dt>
            <dd className="font-mono font-bold text-foreground">{leg.strike}</dd>
            <dt className="text-muted">价位</dt>
            <dd>{leg.moneyness}（贴近现价流动性更好）</dd>
            <dt className="text-muted">置信度</dt>
            <dd>{leg.confidence}</dd>
          </dl>
        </div>
      ) : null}

      <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-[12px] leading-relaxed text-foreground-soft">
        {leg.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <p className="mt-2 text-[11px] text-muted-soft">{leg.riskNote}</p>
    </article>
  );
}

export async function ExpiringOptionsPlaybook({ compact = false }: { compact?: boolean }) {
  const pb = await buildTodayExpiringOptionsPlaybook();

  return (
    <section className="card overflow-hidden">
      <header className="border-b border-border bg-accent-soft/40 px-4 py-3">
        <span className="label-caps">今日策略 · 0DTE</span>
        <h2 className="mt-0.5 text-[17px] font-bold text-foreground">操作建议（普通人跟单版）</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-foreground-soft">
          到期 <span className="font-mono">{pb.expirationDate}</span>
          {" · "}
          {pb.marketMood}
        </p>
      </header>

      <div className="px-4 py-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">纪律（先看）</h3>
        <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-muted-soft">
          {pb.discipline.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-accent-strong">·</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </div>

      {pb.followPicks.length === 0 ? (
        <p className="border-t border-border px-4 py-6 text-center text-[12px] text-muted">
          今日成交不足以生成明确跟单建议，请以观望为主。
        </p>
      ) : (
        <div
          className={`grid gap-3 border-t border-border px-4 py-4 ${
            compact ? "grid-cols-1" : "md:grid-cols-1 lg:grid-cols-3"
          }`}
        >
          {pb.followPicks.map((leg, i) => (
            <PickCard key={`${leg.underlying}-${leg.action}`} leg={leg} index={i} />
          ))}
        </div>
      )}

      {!compact ? (
        <div className="border-t border-border px-4 py-2.5 text-[10px] leading-relaxed text-muted-soft">
          {pb.disclaimer}
        </div>
      ) : (
        <p className="border-t border-border px-4 py-2 text-[10px] text-muted-soft">
          <Link href="/expiring-options" className="font-semibold text-accent-strong hover:underline">
            查看完整策略与雷达 →
          </Link>
        </p>
      )}
    </section>
  );
}
