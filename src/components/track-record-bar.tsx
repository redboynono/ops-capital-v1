import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getPicksTeaser, isPicksTeaserPresentable } from "@/lib/picks";

/**
 * 信任条：用 OPS 精选（可跟单）真实战绩建立信任，放在付费墙与 /pricing。
 * 负战绩或样本不足时不渲染，避免反效果。
 */
export async function TrackRecordBar(_props: { variant?: "paywall" | "pricing" } = {}) {
  const [locale, teaser] = await Promise.all([getLocale(), getPicksTeaser()]);
  if (!teaser || !isPicksTeaserPresentable(teaser)) return null;

  const en = locale === "en";
  const pct = (n: number | null, withSign = false) =>
    n == null ? "—" : `${withSign && n > 0 ? "+" : ""}${n.toFixed(1)}%`;

  const showClosed = teaser.closedCount >= 2;
  const headlineMetric = showClosed ? teaser.avgReturnPct : teaser.avgOpenUnrealizedPct;
  const headlineLabel = showClosed
    ? en
      ? "avg realized"
      : "已平仓均收益"
    : en
      ? "open avg"
      : "持仓均浮盈";

  const t = {
    label: en ? "OPS Picks Track Record" : "OPS 精选战绩",
    sample:
      teaser.closedCount >= 2
        ? en
          ? `${teaser.closedCount} closed · ${teaser.openCount} open`
          : `已平 ${teaser.closedCount} · 持仓 ${teaser.openCount}`
        : en
          ? `${teaser.totalPicks} picks`
          : `精选 ${teaser.totalPicks} 笔`,
    winRate: en ? "win rate" : "胜率",
    verify: en ? "View picks →" : "查看精选 →",
  };

  return (
    <Link
      href="/picks"
      className="not-prose mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[color:var(--success)]/40 bg-[color:var(--success)]/8 px-3 py-2 text-[12px] no-underline transition hover:border-[color:var(--success)]/70"
    >
      <span className="font-semibold text-[color:var(--success)]">📊 {t.label}</span>
      <span className="text-foreground-soft">{t.sample}</span>
      {showClosed && teaser.winRatePct != null ? (
        <span className="text-foreground">
          {t.winRate}{" "}
          <strong className="text-[color:var(--success)]">{pct(teaser.winRatePct)}</strong>
        </span>
      ) : null}
      {headlineMetric != null ? (
        <span className="text-foreground">
          {headlineLabel}{" "}
          <strong
            className={
              headlineMetric >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
            }
          >
            {pct(headlineMetric, true)}
          </strong>
        </span>
      ) : null}
      {teaser.bestClosed ? (
        <span className="text-foreground-soft">
          best <strong className="text-[color:var(--success)]">{teaser.bestClosed.ticker}</strong>{" "}
          {pct(teaser.bestClosed.pct, true)}
        </span>
      ) : null}
      <span className="ml-auto text-[11px] text-muted">{t.verify}</span>
    </Link>
  );
}
