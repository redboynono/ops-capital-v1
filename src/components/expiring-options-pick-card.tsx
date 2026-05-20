import Link from "next/link";
import type { FollowLeg, PlayAction } from "@/lib/expiring-options-playbook";

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

export function ExpiringOptionsPickCard({
  leg,
  index,
  badge,
}: {
  leg: FollowLeg;
  index?: number;
  badge?: string;
}) {
  const style = ACTION_STYLE[leg.action];
  const typeZh = leg.contractType === "call" ? "看涨 Call" : "看跌 Put";

  return (
    <article className={`rounded-md border p-4 ${style.bg} ${style.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {badge ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {badge}
            </span>
          ) : index != null ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              建议 {index + 1}
            </span>
          ) : null}
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
