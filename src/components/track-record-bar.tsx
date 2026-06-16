import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getTrackRecordTeaser } from "@/lib/track-record";

/**
 * 信任条：用真实评级战绩（BUY 组跑赢 SPY 比例 / 平均超额）建立信任，
 * 放在付费墙顶部与 /pricing 页。样本不足时（<3）不渲染，避免反效果。
 */
export async function TrackRecordBar({
  variant = "paywall",
}: {
  variant?: "paywall" | "pricing";
}) {
  const [locale, teaser] = await Promise.all([getLocale(), getTrackRecordTeaser()]);
  if (!teaser || teaser.buyCount < 3) return null;

  const en = locale === "en";
  const pct = (n: number | null, withSign = false) =>
    n == null ? "—" : `${withSign && n > 0 ? "+" : ""}${n.toFixed(1)}%`;

  const winRate = teaser.buyWinRate;
  const avgExcess = teaser.buyAvgExcess;

  const t = {
    label: en ? "OPS Picks Track Record" : "OPS 精选战绩",
    sample: en ? `${teaser.buyCount} BUY calls` : `BUY 评级 ${teaser.buyCount} 个`,
    beat: en ? "beat SPY" : "跑赢 SPY",
    avgExcess: en ? "avg excess" : "平均超额",
    verify: en ? "Verify →" : "查看明细 →",
  };

  return (
    <Link
      href="/track-record"
      className="not-prose mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[color:var(--success)]/40 bg-[color:var(--success)]/8 px-3 py-2 text-[12px] no-underline transition hover:border-[color:var(--success)]/70"
    >
      <span className="font-semibold text-[color:var(--success)]">
        📊 {t.label}
      </span>
      <span className="text-foreground-soft">{t.sample}</span>
      {winRate != null ? (
        <span className="text-foreground">
          {t.beat}{" "}
          <strong className="text-[color:var(--success)]">{pct(winRate)}</strong>
        </span>
      ) : null}
      {avgExcess != null ? (
        <span className="text-foreground">
          {t.avgExcess}{" "}
          <strong className={avgExcess >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}>
            {pct(avgExcess, true)}
          </strong>
        </span>
      ) : null}
      <span className="ml-auto text-[11px] text-muted">{t.verify}</span>
    </Link>
  );
}
