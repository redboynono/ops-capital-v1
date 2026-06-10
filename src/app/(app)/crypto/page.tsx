import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { mysqlQuery } from "@/lib/mysql";
import { FactorRadar } from "@/components/factor-radar";
import { fetchCryptoMarkets, type CryptoMarketRow } from "@/lib/coingecko";
import {
  CRYPTO_FACTORS,
  FACTOR_LABELS,
  VERDICT_LABELS,
  type FactorKey,
  type Grade,
  type Verdict,
} from "@/lib/ratings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "加密评分 · OPS Alpha",
  description: "OPS 加密原生六因子量化评分（CoinGecko 数据驱动）",
};

type CryptoListRow = {
  symbol: string;
  name: string;
  coingecko_id: string | null;
  ops_verdict: Verdict | null;
  quant_score: string | null;
  industry: string | null;
  updated_at: string | null;
};

type GradeRow = { symbol: string; factor: FactorKey; grade_now: Grade | null };

const GRADE_COLOR: Record<string, string> = {
  A: "#4ade80", B: "#a3e635", C: "#facc15", D: "#fb923c", F: "#f87171",
};
function gradeColor(g: Grade | null | undefined): string {
  if (!g) return "var(--muted)";
  return GRADE_COLOR[g[0]] ?? "var(--muted)";
}

const VERDICT_BG: Record<Verdict, string> = {
  STRONG_BUY: "#166534",
  BUY: "#15803d",
  HOLD: "#ca8a04",
  SELL: "#dc2626",
  STRONG_SELL: "#7f1d1d",
};

function fmtMcap(v: number | null) {
  if (v == null || v <= 0) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  return `$${(v / 1e6).toFixed(0)}M`;
}
function fmtPrice(v: number | null) {
  if (v == null) return "—";
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

export default async function CryptoPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/crypto");

  const rows = await mysqlQuery<CryptoListRow[]>(
    `select t.symbol, t.name, t.coingecko_id,
            r.ops_verdict, r.quant_score, r.industry, r.updated_at
       from tickers t
       left join ticker_ratings r on r.symbol = t.symbol
      where t.asset_class = 'crypto'
      order by r.quant_score is null, r.quant_score desc`,
  );

  const symbols = rows.map((r) => r.symbol);
  const [gradeRows, markets] = await Promise.all([
    symbols.length > 0
      ? mysqlQuery<GradeRow[]>(
          `select symbol, factor, grade_now from ticker_factor_grades
            where symbol in (${symbols.map(() => "?").join(",")})
              and factor in (${CRYPTO_FACTORS.map(() => "?").join(",")})`,
          [...symbols, ...CRYPTO_FACTORS],
        )
      : Promise.resolve([] as GradeRow[]),
    fetchCryptoMarkets(rows.map((r) => r.coingecko_id).filter((x): x is string => !!x)),
  ]);

  const gradeMap = new Map<string, Partial<Record<FactorKey, Grade | null>>>();
  for (const g of gradeRows) {
    const m = gradeMap.get(g.symbol) ?? {};
    m[g.factor] = g.grade_now;
    gradeMap.set(g.symbol, m);
  }
  const marketMap = new Map<string, CryptoMarketRow>();
  for (const m of markets) marketMap.set(m.coingeckoId, m);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Crypto Quant</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">加密六因子评分</h1>
        <p className="mt-1 text-[13px] text-muted">
          估值 / 网络采用 / 代币经济 / 动量 / 流动性 / 安全 · CoinGecko 数据确定性打分 · 与股票评级同一 Quant 标尺（1–5）
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">暂无加密标的。</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2">标的</th>
                <th className="px-3 py-2 text-right">价格</th>
                <th className="px-3 py-2 text-right">24h</th>
                <th className="px-3 py-2 text-right">市值</th>
                <th className="px-3 py-2 text-center">OPS Verdict</th>
                <th className="px-3 py-2 text-center">Quant</th>
                {CRYPTO_FACTORS.map((f) => (
                  <th key={f} className="px-2 py-2 text-center" title={FACTOR_LABELS[f]}>
                    {FACTOR_LABELS[f].split(" ").pop()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => {
                const mkt = r.coingecko_id ? marketMap.get(r.coingecko_id) : undefined;
                const grades = gradeMap.get(r.symbol) ?? {};
                const pct = mkt?.pct24h ?? null;
                const pctClass = pct == null ? "text-muted" : pct > 0 ? "up" : pct < 0 ? "down" : "flat";
                return (
                  <tr key={r.symbol} className="hover:bg-surface-muted">
                    <td className="px-3 py-2.5">
                      <Link href={`/t/${r.symbol}`} className="font-mono font-bold text-accent-strong hover:underline">
                        {r.symbol}
                      </Link>
                      <span className="ml-2 text-muted">{r.name}</span>
                      {r.industry ? (
                        <span className="ml-2 rounded-sm border border-border px-1 py-0.5 text-[10px] text-muted">{r.industry}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtPrice(mkt?.priceUsd ?? null)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono ${pctClass}`}>
                      {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{fmtMcap(mkt?.marketCapUsd ?? null)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {r.ops_verdict ? (
                        <span
                          className="inline-flex items-center justify-center rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
                          style={{ background: VERDICT_BG[r.ops_verdict] }}
                        >
                          {VERDICT_LABELS[r.ops_verdict].en}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold">
                      {r.quant_score != null ? Number(r.quant_score).toFixed(2) : "—"}
                    </td>
                    {CRYPTO_FACTORS.map((f) => (
                      <td key={f} className="px-2 py-2.5 text-center font-mono font-bold" style={{ color: gradeColor(grades[f]) }}>
                        {grades[f] ?? "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 因子画像雷达 */}
      {rows.length > 0 ? (
        <section className="mt-6">
          <header className="mb-3 border-b border-border pb-2">
            <span className="label-caps">Factor Profile</span>
            <h2 className="mt-1 text-lg font-bold text-foreground">因子画像</h2>
            <p className="mt-1 text-[12px] text-muted">六轴雷达 · 外环 = A+ · 圆心 = 无数据/F</p>
          </header>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows
              .filter((r) => r.quant_score != null)
              .map((r) => {
                const grades = gradeMap.get(r.symbol) ?? {};
                return (
                  <div key={r.symbol} className="card p-3">
                    <div className="flex items-baseline justify-between">
                      <Link href={`/t/${r.symbol}`} className="font-mono text-[14px] font-bold text-accent-strong hover:underline">
                        {r.symbol}
                      </Link>
                      <span className="font-mono text-[12px] font-bold text-foreground">
                        Quant {Number(r.quant_score).toFixed(2)}
                      </span>
                    </div>
                    <FactorRadar
                      uid={r.symbol}
                      axes={CRYPTO_FACTORS.map((f) => ({
                        label: FACTOR_LABELS[f].split(" ").pop() ?? f,
                        grade: grades[f] ?? null,
                      }))}
                    />
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}

      {/* 六因子方法论 */}
      <section className="mt-6">
        <header className="mb-3 border-b border-border pb-2">
          <span className="label-caps">Methodology</span>
          <h2 className="mt-1 text-lg font-bold text-foreground">六因子是怎么打分的</h2>
          <p className="mt-1 text-[12px] text-muted">
            每个因子由若干子指标确定性计算（无 AI 主观判断），得 A+ 到 F 等级；按权重折算 GPA 后映射为
            1.00–5.00 的 Quant 分 — 与股票评级同一把标尺，跨市场可直接比分。
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              name: "估值",
              en: "VALUATION",
              weight: "20%",
              desc: "现在买入贵不贵",
              metrics: ["FDV 稀释度（市值/全稀释市值）", "距历史高点回撤（越深分越高）", "换手健康度（成交/市值 0.02–0.15 为佳）"],
            },
            {
              name: "网络采用",
              en: "NETWORK",
              weight: "25%",
              desc: "链的「成长+盈利」：使用量即现金流",
              metrics: ["开发者活动（4 周提交数）", "社区规模（Twitter + Reddit）", "市值地位（排名）", "公众情绪投票"],
            },
            {
              name: "代币经济",
              en: "TOKENOMICS",
              weight: "15%",
              desc: "持仓会不会被增发/解锁稀释",
              metrics: ["有无供应硬顶", "流通占比（越高越好）", "剩余增发压力"],
            },
            {
              name: "动量",
              en: "MOMENTUM",
              weight: "20%",
              desc: "趋势是否站在你这边",
              metrics: ["30 天收益", "200 天收益", "相对 BTC 强弱（30 天）"],
            },
            {
              name: "流动性",
              en: "LIQUIDITY",
              weight: "10%",
              desc: "进得去也出得来，防操纵",
              metrics: ["24h 成交规模", "上所广度", "活跃交易对数量"],
            },
            {
              name: "安全",
              en: "SECURITY",
              weight: "10%",
              desc: "久经考验程度与类别风险",
              metrics: ["主网存续年限（10 年满分）", "市值地位", "类别风险（meme 直接降档）"],
            },
          ].map((f) => (
            <div key={f.en} className="card p-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-foreground">
                  {f.name}
                  <span className="ml-1.5 font-mono text-[10px] font-normal text-muted">{f.en}</span>
                </p>
                <span className="rounded-sm bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent-strong">
                  权重 {f.weight}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted">{f.desc}</p>
              <ul className="mt-2 space-y-1">
                {f.metrics.map((m) => (
                  <li key={m} className="flex gap-1.5 text-[11px] text-foreground-soft">
                    <span className="text-accent-strong">·</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          为什么不直接用股票五因子？币没有 EPS、毛利率和卖方盈利预期，估值/成长/盈利/预期修正对加密资产没有语义。
          六因子为加密原生设计，但与股票共享动量定义和整条评分管线。完整模型阐述见
          <Link href="/analysis/crypto-six-factor-debut-2026-06" className="mx-1 font-semibold text-accent-strong hover:underline">
            《加密六因子首评》
          </Link>
          。
        </p>
      </section>

      <p className="mt-3 text-[11px] text-muted">
        数据源 CoinGecko · 每日自动重打分 · Phase 1 未含链上指标（MVRV / 活跃地址），Phase 2 加入 · 评分非投资建议（DYOR）。
      </p>
    </div>
  );
}
