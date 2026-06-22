import Link from "next/link";
import type { FollowLeg, PlayAction } from "@/lib/expiring-options-playbook";
import { fmt } from "@/lib/i18n/fmt";
import type { Dictionary } from "@/lib/i18n/zh";

export type PickCardCopy = Dictionary["optionsPage"]["pickCard"];

const ACTION_STYLE: Record<
  PlayAction,
  { bg: string; border: string; text: string }
> = {
  long: {
    bg: "bg-[color:color-mix(in_srgb,var(--success)_12%,transparent)]",
    border: "border-[color:var(--success)]",
    text: "text-[color:var(--success)]",
  },
  short: {
    bg: "bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)]",
    border: "border-[color:var(--danger)]",
    text: "text-[color:var(--danger)]",
  },
  watch: {
    bg: "bg-surface-muted",
    border: "border-border",
    text: "text-muted",
  },
};

function actionLabel(action: PlayAction, ui: PickCardCopy): string {
  if (action === "long") return ui.actionLong;
  if (action === "short") return ui.actionShort;
  return ui.actionWatch;
}

function confidenceLabel(conf: FollowLeg["confidence"], ui: PickCardCopy): string {
  if (conf === "high") return ui.confidenceHigh;
  if (conf === "medium") return ui.confidenceMed;
  return ui.confidenceLow;
}

export function ExpiringOptionsPickCard({
  leg,
  index,
  badge,
  ui,
}: {
  leg: FollowLeg;
  index?: number;
  badge?: string;
  ui: PickCardCopy;
}) {
  const style = ACTION_STYLE[leg.action];
  const typeLabel = leg.contractType === "call" ? "Call" : "Put";

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
              {fmt(ui.pickFmt, { n: index + 1 })}
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
          {actionLabel(leg.action, ui)}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-foreground-soft">{leg.headline}</p>

      {leg.action !== "watch" ? (
        <div className="mt-3 rounded border border-border bg-surface px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            {ui.followPoints}
          </p>
          <dl className="mt-1.5 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 text-[12px]">
            <dt className="text-muted">{ui.direction}</dt>
            <dd className="font-semibold text-foreground">{typeLabel}</dd>
            <dt className="text-muted">{ui.strike}</dt>
            <dd className="font-mono font-bold text-foreground">{leg.strike}</dd>
            <dt className="text-muted">{ui.moneyness}</dt>
            <dd>
              {leg.moneyness} ({ui.moneynessHint})
            </dd>
            <dt className="text-muted">{ui.confidence}</dt>
            <dd>{confidenceLabel(leg.confidence, ui)}</dd>
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
