import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ValueChainStack } from "@/components/marketing/value-chain-stack";
import { AI_VALUE_CHAIN_LAYERS, INVESTMENT_FOCUS } from "@/lib/marketing/ai-value-chain";
import { getValueChainLinkage } from "@/lib/marketing/value-chain-data";

export const dynamic = "force-dynamic";

/** Gumroad 结账页「Continue shopping」会跳到卖家资料里填的主站 URL，常为首页 */
function shouldRedirectGumroadReturn(referer: string | null): boolean {
  if (!referer) return false;
  return /gumroad\.com/i.test(referer);
}

const theme = {
  bg: "#f5f1ea",
  bgAlt: "#ede7dc",
  ink: "#121212",
  inkSoft: "#3a3732",
  muted: "#6f6b64",
  gold: "#b08b57",
  line: "#d9d1c2",
};

const beliefs = [
  {
    k: "01",
    title: "数据高于感觉",
    body: "所有投资决策必须可回溯、可复盘。我们用系统化的研究流程替代盘感，把每一笔判断都沉淀为资产。",
  },
  {
    k: "02",
    title: "原则高于个人",
    body: "我们把资深研究员的 judgment 提炼为 rules，再通过 AI 放大到整个团队，让好的决策可以规模化。",
  },
  {
    k: "03",
    title: "长期高于短期",
    body: "在周期里生存，才能在拐点里受益。我们拒绝追涨杀跌，以 12–36 个月的视角持有核心资产。",
  },
];

const alphaFeatures = [
  "AI 产业六层价值链 · 全链标的覆盖与评级",
  "机构级深度研报 + 估值模型与因子评分",
  "半导体 / 算力 / 大模型 / Agent 每日快讯",
  "自选股桌面 · 评级变动 · AI 编辑流水线",
];

const coverageTags = [
  "晶圆代工",
  "光刻 / HBM",
  "GPU / ASIC",
  "算力云",
  "Hyperscaler",
  "大模型",
  "AI Agent",
];

export default async function MarketingHome() {
  const h = await headers();
  if (shouldRedirectGumroadReturn(h.get("referer"))) {
    redirect("/pricing");
  }

  const [user, linkage] = await Promise.all([getSessionUser(), getValueChainLinkage()]);
  const ctaLabel = user ? "打开 Alpha 工作台" : "进入 OPS Alpha";

  return (
    <main style={{ background: theme.bg, color: theme.ink, fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif' }}>
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{ background: `${theme.bg}e6`, borderBottom: `1px solid ${theme.line}` }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-baseline gap-2 text-[15px] font-bold tracking-[0.18em]"
            style={{ color: theme.ink }}
          >
            <span style={{ color: theme.gold }}>◆</span>
            <span>OPS CAPITAL</span>
          </Link>
          <nav
            className="hidden items-center gap-8 text-[13px] tracking-wide md:flex"
            style={{ color: theme.inkSoft }}
          >
            <a href="#focus" className="hover:opacity-70">投资重点</a>
            <a href="#value-chain" className="hover:opacity-70">六层价值链</a>
            <a href="#philosophy" className="hover:opacity-70">理念</a>
            <a href="#alpha" className="hover:opacity-70">OPS Alpha</a>
            <Link href="/contact" className="hover:opacity-70">联系</Link>
          </nav>
          <div className="flex items-center gap-3 text-[13px]">
            {user ? (
              <Link
                href="/alpha"
                className="rounded-none px-4 py-2 font-semibold"
                style={{ background: theme.ink, color: theme.bg }}
              >
                打开 Alpha →
              </Link>
            ) : (
              <>
                <Link href="/login" style={{ color: theme.inkSoft }} className="hover:opacity-70">
                  登录
                </Link>
                <Link
                  href="/alpha"
                  className="px-4 py-2 font-semibold"
                  style={{ background: theme.ink, color: theme.bg }}
                >
                  进入 OPS Alpha →
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20 pt-20 md:pt-28">
        <p className="text-[11px] font-semibold tracking-[0.36em]" style={{ color: theme.gold }}>
          OPS CAPITAL · AI & SEMICONDUCTORS
        </p>
        <h1
          className="mt-6 text-5xl leading-[1.08] md:text-7xl"
          style={{ color: theme.ink, letterSpacing: "-0.01em" }}
        >
          深耕 AI 与<br />
          <span style={{ fontStyle: "italic", color: theme.gold }}>半导体</span>价值链
        </h1>
        <p className="mt-8 max-w-2xl text-[17px] leading-[1.85]" style={{ color: theme.inkSoft }}>
          OPS Capital 以六层产业框架系统追踪 AI 算力革命——从晶圆制造、芯片设计、算力基建，
          到云分发、大模型与 Agent 应用。我们用原则驱动的研究与 AI 杠杆，帮助长期投资者在
          物理瓶颈与估值博弈中识别结构性阿尔法。
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {coverageTags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 text-[12px] tracking-wide"
              style={{ border: `1px solid ${theme.line}`, color: theme.muted }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-5 text-[13px]">
          <Link
            href="/alpha"
            className="px-7 py-3 font-semibold"
            style={{ background: theme.ink, color: theme.bg }}
          >
            {ctaLabel} →
          </Link>
          <a href="#value-chain" style={{ color: theme.ink }} className="border-b pb-0.5">
            探索六层价值链模型
          </a>
        </div>
      </section>

      {/* Stats */}
      <section style={{ background: theme.bgAlt, borderTop: `1px solid ${theme.line}`, borderBottom: `1px solid ${theme.line}` }}>
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {[
            { k: "价值链层级", v: "L0–L5" },
            { k: "核心标的", v: "30+" },
            { k: "研究深度", v: "机构级" },
            { k: "更新频率", v: "每日" },
          ].map((s) => (
            <div key={s.k}>
              <p className="text-[11px] tracking-[0.28em]" style={{ color: theme.muted }}>
                {s.k.toUpperCase()}
              </p>
              <p className="mt-3 text-4xl md:text-5xl" style={{ color: theme.ink, letterSpacing: "-0.02em" }}>
                {s.v}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Investment Focus */}
      <section id="focus" className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.32em]" style={{ color: theme.gold }}>
              INVESTMENT FOCUS
            </p>
            <h2 className="mt-4 text-3xl md:text-4xl" style={{ letterSpacing: "-0.01em" }}>
              AI 算力革命，<br />
              我们的主战场。
            </h2>
          </div>
          <div className="space-y-6 text-[16px] leading-[1.9]" style={{ color: theme.inkSoft }}>
            <p>
              2024–2026 年，全球资本开支重心已从「模型参数竞赛」转向「物理产能与能源约束」。
              我们聚焦半导体制造链、AI 算力基础设施与大模型商业化三条主线，以 OPS 自研的
              六层价值链模型贯穿选股、评级与仓位决策。
            </p>
            <p>
              组合横跨台积电 / 英伟达等定价权龙头、Equinix / Nebius 等算力地产、
              以及 Azure / AWS 等云分发入口——并在 L4/L5 持续跟踪大模型 IPO 与 Agent 范式迁移。
            </p>
          </div>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {INVESTMENT_FOCUS.map((p, i) => (
            <article
              key={p.k}
              className="p-8"
              style={{ border: `1px solid ${theme.line}`, background: i === 1 ? theme.bgAlt : "transparent" }}
            >
              <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.muted }}>
                FOCUS {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-xl" style={{ letterSpacing: "-0.01em" }}>
                {p.k}
              </h3>
              <p className="mt-4 text-[14px] leading-[1.85]" style={{ color: theme.inkSoft }}>
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Six-Layer Value Chain */}
      <section
        id="value-chain"
        style={{ background: theme.ink, color: theme.bg }}
        className="px-6 py-24"
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[11px] font-semibold tracking-[0.32em]" style={{ color: theme.gold }}>
                AI VALUE CHAIN · L0 → L5
              </p>
              <h2 className="mt-4 text-3xl md:text-5xl" style={{ letterSpacing: "-0.01em" }}>
                AI 产业<br />六层价值链
              </h2>
              <p className="mt-6 text-[15px] leading-[1.9]" style={{ color: "#c8c2b4" }}>
                自研产业框架，自下而上穿透物理制造（L0）到智能体应用（L5）。
                每一层标注核心代表、2026 年商业与技术趋势，并映射到 OPS Alpha 的标的评级与深度研报。
              </p>
              <p className="mt-6 text-[13px] italic" style={{ color: "#8a857a" }}>
                — Steven Sun · CIO, OPS Capital
              </p>
              <Link
                href="/tickers"
                className="mt-8 inline-block px-6 py-3 text-[13px] font-semibold"
                style={{ border: `1px solid ${theme.gold}`, color: theme.gold }}
              >
                浏览全市场标的 →
              </Link>
            </div>

            <div>
              <ValueChainStack layers={AI_VALUE_CHAIN_LAYERS} linkage={linkage} theme={theme} />
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section id="philosophy" className="mx-auto max-w-[1200px] px-6 py-24">
        <p className="text-[11px] font-semibold tracking-[0.32em]" style={{ color: theme.gold }}>
          WHAT WE BELIEVE
        </p>
        <h2 className="mt-4 text-3xl md:text-5xl" style={{ letterSpacing: "-0.01em" }}>
          我们的信念
        </h2>

        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {beliefs.map((b) => (
            <div key={b.k}>
              <p className="text-[11px] tracking-[0.36em]" style={{ color: theme.gold }}>
                {b.k}
              </p>
              <h3 className="mt-5 text-2xl" style={{ letterSpacing: "-0.01em" }}>
                {b.title}
              </h3>
              <p className="mt-4 text-[15px] leading-[1.9]" style={{ color: theme.inkSoft }}>
                {b.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* OPS Alpha */}
      <section
        id="alpha"
        style={{ background: theme.bgAlt, borderTop: `1px solid ${theme.line}`, borderBottom: `1px solid ${theme.line}` }}
        className="px-6 py-24"
      >
        <div className="mx-auto grid max-w-[1200px] gap-12 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.32em]" style={{ color: theme.gold }}>
              CHANNEL · OPS ALPHA
            </p>
            <h2 className="mt-4 text-3xl md:text-5xl" style={{ letterSpacing: "-0.01em" }}>
              OPS Alpha
              <br />
              <span style={{ color: theme.muted, fontSize: "0.6em", fontStyle: "italic" }}>
                AI 投研桌面 · 六层框架落地
              </span>
            </h2>
            <p className="mt-6 max-w-xl text-[16px] leading-[1.9]" style={{ color: theme.inkSoft }}>
              OPS Alpha 将 OPS Capital 内部的 AI 研究流水线、六层价值链标的库与量化评级
              开放给专业个人投资者——以订阅制获得机构级视角，每日跟踪半导体与 AI 产业链动态。
            </p>

            <div className="mt-8 flex flex-wrap gap-4 text-[13px]">
              <Link
                href="/alpha"
                className="px-6 py-3 font-semibold"
                style={{ background: theme.ink, color: theme.bg }}
              >
                {ctaLabel} →
              </Link>
              <Link
                href="/pricing"
                className="px-6 py-3 font-semibold"
                style={{ border: `1px solid ${theme.ink}`, color: theme.ink }}
              >
                查看订阅方案
              </Link>
            </div>
          </div>

          <ul className="space-y-5">
            {alphaFeatures.map((f, i) => (
              <li
                key={f}
                className="flex items-start gap-4 py-4"
                style={{ borderBottom: `1px solid ${theme.line}` }}
              >
                <span className="font-mono pt-1 text-[12px]" style={{ color: theme.gold, letterSpacing: "0.1em" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] leading-[1.75]" style={{ color: theme.ink }}>
                  {f}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer id="contact" style={{ background: theme.ink, color: theme.bg }} className="px-6 py-16">
        <div className="mx-auto grid max-w-[1200px] gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="flex items-baseline gap-2 text-[15px] font-bold tracking-[0.2em]">
              <span style={{ color: theme.gold }}>◆</span>
              <span>OPS CAPITAL</span>
            </p>
            <p className="mt-5 max-w-sm text-[14px] leading-[1.9]" style={{ color: "#c8c2b4" }}>
              Research-driven investment firm focused on AI & semiconductor value chains.
              We combine disciplined principles with AI leverage to navigate cycles from
              wafer fabs to foundation models.
            </p>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>
              CHANNELS
            </p>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "#d6d0c2" }}>
              <li>
                <Link href="/alpha" className="hover:opacity-70">
                  OPS Alpha · 投研桌面
                </Link>
              </li>
              <li>
                <Link href="/analysis" className="hover:opacity-70">
                  分析长文
                </Link>
              </li>
              <li>
                <Link href="/news" className="hover:opacity-70">
                  市场快讯
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:opacity-70">
                  订阅方案
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>
              CONTACT
            </p>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "#d6d0c2" }}>
              <li>
                <a href="mailto:steven.sun@opscapital.com" className="hover:opacity-70">
                  steven.sun@opscapital.com
                </a>
              </li>
              <li>Singapore · Hong Kong</li>
              <li>
                <Link href="/contact" className="hover:opacity-70" style={{ color: theme.gold }}>
                  查看全部联系方式 →
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div
          className="mx-auto mt-12 max-w-[1200px] border-t pt-6 text-[11px]"
          style={{ borderColor: "#2a2a2a", color: "#8a857a" }}
        >
          © {new Date().getFullYear()} OPS Capital · 本站内容仅供投资研究参考，不构成任何买卖建议。投资有风险，决策需谨慎。
        </div>
      </footer>
    </main>
  );
}
