import Link from "next/link";

export const metadata = { title: "使用说明 · OPS Alpha" };

const pages: { label: string; href: string; desc: string }[] = [
  { label: "HOME",  href: "/alpha",               desc: "Alpha 首页：市场快照 + OPS Quant Top + 热门分析 + 今日快讯" },
  { label: "ANLY",  href: "/analysis",            desc: "机构级深度研报列表（Premium 需订阅）" },
  { label: "NEWS",  href: "/news",                desc: "市场快讯时间流，全部免费" },
  { label: "SCRN",  href: "/tickers",             desc: "标的索引：按交易所分组的全部 ticker" },
  { label: "WATCH", href: "/dashboard/watchlist", desc: "自选股清单" },
  { label: "ACCT",  href: "/dashboard",           desc: "会员桌面：订阅状态 + 收藏 + 阅读历史 + 自选概览" },
  { label: "SUB",   href: "/pricing",             desc: "订阅方案（$9.99/月 · $87.99/年，含 1 周免费试用）" },
  { label: "HELP",  href: "/help",                desc: "本页：使用说明" },
];

const ratingNotes: { k: string; v: string }[] = [
  { k: "OPS Desk",  v: "OPS Alpha 自营分析师 / AI 模型结合打分（STRONG_BUY ~ STRONG_SELL，1-5 分）" },
  { k: "Street",    v: "华尔街卖方共识（来自分析师群体的 verdict + 目标价）" },
  { k: "OPS Quant", v: "五因子加权：估值 25% / 成长 25% / 盈利 20% / 动量 15% / 修正 15%。映射到 1-5 分" },
];

const gradeMeaning: { g: string; meaning: string; color: string }[] = [
  { g: "A+ / A / A-", meaning: "显著优于同行业分位",   color: "#15803d" },
  { g: "B+ / B / B-", meaning: "优于或接近同行",         color: "#84cc16" },
  { g: "C+ / C / C-", meaning: "中位区间",               color: "#ca8a04" },
  { g: "D+ / D / D-", meaning: "显著劣于同行",           color: "#d97706" },
  { g: "F",           meaning: "垫底，高风险或估值极端", color: "#b91c1c" },
];

export default function HelpPage() {
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Help</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">使用说明</h1>
        <p className="mt-1 text-[13px] text-muted">
          OPS Alpha 是 OPS Capital 旗下的 AI 投研终端。以下是主要功能导航。
        </p>
      </header>

      <section className="card mb-5">
        <header className="border-b border-border px-4 py-2.5">
          <p className="label-caps">页面导航</p>
          <p className="mt-1 text-[11px] text-muted">
            使用侧边栏或底部导航条点击跳转。
          </p>
        </header>
        <div className="divide-y divide-border">
          {pages.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="row-hover flex items-center gap-4 px-4 py-2.5 text-[13px]"
            >
              <span className="w-16 font-mono font-bold text-accent-strong">{p.label}</span>
              <span className="flex-1 text-foreground-soft">{p.desc}</span>
              <span className="font-mono text-[11px] text-muted-soft">{p.href}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card mb-5">
        <header className="border-b border-border px-4 py-2.5">
          <p className="label-caps">OPS Rating 说明</p>
        </header>
        <div className="divide-y divide-border">
          {ratingNotes.map((r) => (
            <div key={r.k} className="flex items-start gap-4 px-4 py-2.5 text-[13px]">
              <span className="w-24 font-mono font-bold text-accent-strong">{r.k}</span>
              <span className="flex-1 text-foreground-soft">{r.v}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-5">
        <header className="border-b border-border px-4 py-2.5">
          <p className="label-caps">Factor Grades 解读</p>
          <p className="mt-1 text-[11px] text-muted">
            同行业分位法：A+ = 显著优于同行（前 10%），F = 垫底（后 5%）。每项给出 Now / 3M / 6M 趋势。
          </p>
        </header>
        <div className="divide-y divide-border">
          {gradeMeaning.map((g) => (
            <div key={g.g} className="flex items-center gap-4 px-4 py-2.5 text-[13px]">
              <span
                className="inline-flex h-7 w-24 items-center justify-center rounded-sm font-mono text-[12px] font-bold text-white"
                style={{ background: g.color }}
              >
                {g.g}
              </span>
              <span className="flex-1 text-foreground-soft">{g.meaning}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-5 p-4">
        <p className="label-caps">免责声明</p>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">
          OPS Alpha 的研报与评级由 AI 编辑流水线辅助生成（MiniMax-M2.7 模型），仅供投资学习与研究参考，不构成任何买卖建议。
          市场有风险，投资需谨慎。
        </p>
      </section>

      <p className="text-center text-[12px] text-muted">
        找不到答案？邮件联系 <a href="mailto:support@opscapital.com" className="font-mono text-accent-strong hover:underline">support@opscapital.com</a>
      </p>
    </div>
  );
}
