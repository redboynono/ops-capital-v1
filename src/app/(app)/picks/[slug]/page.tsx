import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareButton } from "@/components/share/share-button";
import { StickyPaywall } from "@/components/sticky-paywall";
import { getSessionUser } from "@/lib/auth";
import { countRedactions, MaybeBlur, RedactedMarkdown } from "@/lib/paywall";
import { getCurrentUserSubscriptionStatus } from "@/lib/posts";
import { computePerformance, getPickBySlug } from "@/lib/picks";

export const dynamic = "force-dynamic";

function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  return n.toFixed(2);
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toISOString().slice(0, 10);
}

function returnClass(pct: number | null | undefined): string {
  if (pct == null) return "text-muted";
  if (pct > 0) return "text-[color:var(--success)]";
  if (pct < 0) return "text-[color:var(--danger)]";
  return "text-foreground-soft";
}

export default async function PickDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reader?: string }>;
}) {
  const { slug } = await params;
  const { reader } = await searchParams;
  // 默认进入阅读模式；?reader=0 才显示终端视图
  const readerMode = reader !== "0";

  const pick = await getPickBySlug(slug);
  if (!pick || !pick.is_published) notFound();

  const [{ subscribed }, perf, user] = await Promise.all([
    getCurrentUserSubscriptionStatus(),
    computePerformance(pick),
    getSessionUser(),
  ]);

  const canViewFull = !pick.is_premium || subscribed;
  const toggleHref = readerMode ? `/picks/${pick.slug}?reader=0` : `/picks/${pick.slug}`;

  const statusLabel =
    pick.status === "open" ? "开仓中" : pick.status === "closed" ? "已平仓" : "已止损";
  const statusCls =
    pick.status === "open"
      ? "text-[color:var(--success)] border-[color:var(--success)]"
      : pick.status === "stopped"
        ? "text-[color:var(--danger)] border-[color:var(--danger)]"
        : "text-muted border-border";

  const headlinePct = pick.status === "open" ? perf.unrealizedPct : perf.realizedPct;

  return (
    <div className="mx-auto w-full max-w-[880px] px-4 py-6 md:px-6">
      <nav className="flex items-center justify-between text-[12px] text-muted">
        <div>
          <Link href="/picks" className="hover:text-accent-strong">OPS Picks</Link>
          <span className="mx-1">/</span>
          <span className="font-mono">{pick.ticker_symbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <ShareButton
            variant="button"
            data={{
              type: "pick",
              symbol: pick.ticker_symbol,
              title: pick.title,
              subtitle: pick.subtitle,
              conviction: pick.conviction,
              status: pick.status,
              unrealizedPct: perf.unrealizedPct,
              realizedPct: perf.realizedPct,
              entryPrice: pick.entry_price,
              entryDate: new Date(pick.entry_date).toISOString().slice(0, 10),
              targetPrice: pick.target_price,
              stopPrice: pick.stop_price,
              currentPrice: perf.currentPrice,
              thesisMd: canViewFull ? pick.thesis_md : null,
              catalystsMd: canViewFull ? pick.catalysts_md : null,
              risksMd: canViewFull ? pick.risks_md : null,
            }}
            urlPath={`/picks/${pick.slug}`}
            fileNamePrefix={`ops_picks_${pick.ticker_symbol}`}
          />
          <Link
            href={toggleHref}
            className="rounded-sm border border-border px-2 py-0.5 font-mono text-[11px] hover:border-accent hover:text-accent-strong"
          >
            {readerMode ? "☾ 终端视图" : "☀ 阅读模式"}
          </Link>
        </div>
      </nav>

      <div className={readerMode ? "reader-mode mt-3" : "mt-3"}>
        {/* Header block */}
        <header className={readerMode ? "border-b border-[#d8d0c2] pb-4" : "border-b border-border pb-4"}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`mono rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${statusCls}`}>
              {statusLabel}
            </span>
            <Link href={`/t/${pick.ticker_symbol}`} className="chip font-mono">
              {pick.ticker_symbol}
            </Link>
            {pick.is_premium ? <span className="badge-premium">PRO</span> : <span className="badge-free">公开</span>}
            <span className="label-caps">{fmtDate(pick.entry_date)}</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{pick.title}</h1>
          {pick.subtitle ? <p className="mt-1 text-[14px] text-muted">{pick.subtitle}</p> : null}

          {/* Performance strip */}
          <div className={`mt-4 grid grid-cols-2 gap-3 rounded-sm border p-3 md:grid-cols-5 ${readerMode ? "border-[#d8d0c2] bg-[#efe8dc]" : "border-border bg-surface-muted"}`}>
            <div>
              <p className="label-caps text-[10px]">入场价</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold">{fmtPrice(pick.entry_price)}</p>
              <p className="font-mono text-[10px] text-muted">{fmtDate(pick.entry_date)}</p>
            </div>
            <div>
              <p className="label-caps text-[10px]">{pick.status === "open" ? "当前价" : "平仓价"}</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold">{fmtPrice(perf.currentPrice)}</p>
              <p className="font-mono text-[10px] text-muted">持有 {perf.daysHeld}D</p>
            </div>
            <div>
              <p className="label-caps text-[10px]">收益</p>
              <p className={`mt-0.5 font-mono text-[17px] font-bold ${returnClass(headlinePct)}`}>
                {fmtPct(headlinePct)}
              </p>
              <p className="font-mono text-[10px] text-muted">
                {pick.status === "open" ? "浮动" : "已实现"}
              </p>
            </div>
            <div>
              <p className="label-caps text-[10px]">目标价</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold">
                <MaybeBlur value={fmtPrice(pick.target_price)} redact={!canViewFull} />
              </p>
              <p className="font-mono text-[10px] text-muted">{pick.horizon_months}M 期限</p>
            </div>
            <div>
              <p className="label-caps text-[10px]">止损</p>
              <p className="mt-0.5 font-mono text-[17px] font-bold text-[color:var(--danger)]">
                <MaybeBlur value={fmtPrice(pick.stop_price)} redact={!canViewFull} />
              </p>
              <p className="font-mono text-[10px] text-muted">
                {pick.conviction === "high" ? "高信念" : pick.conviction === "low" ? "低信念" : "中等"}
              </p>
            </div>
          </div>

          {pick.status !== "open" && pick.close_reason ? (
            <p className="mt-3 rounded-sm border border-dashed border-border px-3 py-2 text-[12px] text-muted">
              <span className="label-caps mr-2">平仓原因</span>
              {pick.close_reason}
            </p>
          ) : null}
        </header>

        {/* Body */}
        <div className="space-y-6 py-5">
          <Section title="投资逻辑" md={pick.thesis_md} redact={!canViewFull} />
          <Section title="催化剂" md={pick.catalysts_md} redact={!canViewFull} />
          <Section title="风险提示" md={pick.risks_md} redact={!canViewFull} />
          <Section title="估值分析" md={pick.valuation_md} redact={!canViewFull} />
          <Section title="退出纪律" md={pick.sell_discipline_md} redact={!canViewFull} />
        </div>

        {!canViewFull ? (
          <StickyPaywall
            loggedIn={Boolean(user)}
            redactedCount={countRedactions(
              [pick.thesis_md, pick.catalysts_md, pick.risks_md, pick.valuation_md, pick.sell_discipline_md]
                .filter(Boolean)
                .join("\n\n"),
            )}
            variant="picks"
          />
        ) : null}

        <p className={`mt-8 pt-4 text-[11px] leading-relaxed ${readerMode ? "border-t border-[#d8d0c2] text-[#6b5c3f]" : "border-t border-border text-muted-soft"}`}>
          免责声明：本 OPS Pick 为研究观点，不构成投资建议。入场价与目标价为发布时刻基于公开信息的量化模型判断。
        </p>
      </div>
    </div>
  );
}

function Section({ title, md, redact }: { title: string; md: string | null; redact: boolean }) {
  if (!md || md.trim().length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 text-lg font-bold">{title}</h2>
      <article className="prose prose-sm md:prose-base max-w-none">
        <RedactedMarkdown redact={redact}>{md}</RedactedMarkdown>
      </article>
    </section>
  );
}
