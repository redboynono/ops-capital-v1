import Link from "next/link";
import { ExpiringOptionsPickCard } from "@/components/expiring-options-pick-card";
import { buildTodayExpiringOptionsPlaybook } from "@/lib/expiring-options-playbook";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";

export async function ExpiringOptionsPlaybook({
  compact = false,
  expirationDate,
  expiryLabel = "本周五",
}: {
  compact?: boolean;
  expirationDate?: string;
  expiryLabel?: string;
}) {
  const pb = await buildTodayExpiringOptionsPlaybook(expirationDate, expiryLabel);

  return (
    <section className="card overflow-hidden">
      <header className="border-b border-border bg-accent-soft/40 px-4 py-3">
        <span className="label-caps">{OPTION_ALPHA.labelCaps}</span>
        <h2 className="mt-0.5 text-[17px] font-bold text-foreground">{OPTION_ALPHA.strategyTitle}</h2>
        <p className="text-[11px] text-muted">{OPTION_ALPHA.strategySubtitle}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-foreground-soft">
          到期 <span className="font-mono">{pb.expirationDate}</span>（{expiryLabel}）
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
            <ExpiringOptionsPickCard key={`${leg.underlying}-${leg.action}`} leg={leg} index={i} />
          ))}
        </div>
      )}

      {!compact ? (
        <div className="border-t border-border px-4 py-2.5 text-[10px] leading-relaxed text-muted-soft">
          {pb.disclaimer}
        </div>
      ) : (
        <p className="border-t border-border px-4 py-2 text-[10px] text-muted-soft">
          <Link
            href="/expiring-options?week=this"
            className="font-semibold text-accent-strong hover:underline"
          >
            查看完整策略与雷达 →
          </Link>
        </p>
      )}
    </section>
  );
}
