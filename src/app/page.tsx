import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Bridgewater-inspired marketing site: cream background, serif headings, gold accent, generous whitespace.
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

const pillars = [
  {
    k: "全球宏观映射",
    body: "追踪全球流动性、利率与地缘变量，将宏观状态映射到资产配置与风险敞口。",
  },
  {
    k: "科技基本面与估值博弈",
    body: "深度拆解美股科技、港股互联网与半导体供应链，研判估值溢价与戴维斯双击 / 双杀。",
  },
  {
    k: "AI × 多资产组合",
    body: "AI 辅助研究流水线，横跨美股、港股、加密资产与 Pre-IPO，寻找跨市场套利与结构性机会。",
  },
];

const alphaFeatures = [
  "机构级分析长文 + 估值模型",
  "全市场标的聚合页（美股 / 港股 / 加密）",
  "自选股桌面 · 收藏 · 阅读历史",
  "AI 编辑流水线 · 每日更新分析与快讯",
];

export default async function MarketingHome() {
  const user = await getSessionUser();
  const ctaLabel = user ? "打开 Alpha 工作台" : "进入 OPS Alpha";

  return (
    <main style={{ background: theme.bg, color: theme.ink, fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif' }}>
      {/* Top nav */}
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
            <a href="#philosophy" className="hover:opacity-70">理念</a>
            <a href="#approach" className="hover:opacity-70">投资方式</a>
            <a href="#alpha" className="hover:opacity-70">OPS Alpha</a>
            <a href="#contact" className="hover:opacity-70">联系</a>
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
      <section className="mx-auto max-w-[1200px] px-6 pb-24 pt-20 md:pt-32">
        <p
          className="text-[11px] font-semibold tracking-[0.36em]"
          style={{ color: theme.gold }}
        >
          OPS CAPITAL · SINCE 2021
        </p>
        <h1
          className="mt-6 text-5xl leading-[1.08] md:text-7xl"
          style={{ color: theme.ink, letterSpacing: "-0.01em" }}
        >
          穿越周期的<br />
          <span style={{ fontStyle: "italic", color: theme.gold }}>中国</span>投资机构
        </h1>
        <p
          className="mt-8 max-w-2xl text-[17px] leading-[1.85]"
          style={{ color: theme.inkSoft }}
        >
          OPS Capital 以系统化研究、原则驱动的决策与 AI 杠杆，帮助长期投资者理解宏观、识别阿尔法、
          穿越周期。我们相信好的投资，来自严格的研究流程与不被情绪左右的纪律执行。
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-5 text-[13px]">
          <Link
            href="/alpha"
            className="px-7 py-3 font-semibold"
            style={{ background: theme.ink, color: theme.bg }}
          >
            {ctaLabel} →
          </Link>
          <a href="#philosophy" style={{ color: theme.ink }} className="border-b pb-0.5" >
            了解我们的投资理念
          </a>
        </div>
      </section>

      {/* Divider stat band */}
      <section style={{ background: theme.bgAlt, borderTop: `1px solid ${theme.line}`, borderBottom: `1px solid ${theme.line}` }}>
        <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
          {[
            { k: "覆盖市场", v: "4+" },
            { k: "研究标的", v: "500+" },
            { k: "AI 模型", v: "多模态" },
            { k: "决策原则", v: "可回溯" },
          ].map((s) => (
            <div key={s.k}>
              <p className="text-[11px] tracking-[0.28em]" style={{ color: theme.muted }}>
                {s.k.toUpperCase()}
              </p>
              <p
                className="mt-3 text-4xl md:text-5xl"
                style={{ color: theme.ink, letterSpacing: "-0.02em" }}
              >
                {s.v}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Who We Are */}
      <section id="who" className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.32em]" style={{ color: theme.gold }}>
              WHO WE ARE
            </p>
            <h2 className="mt-4 text-3xl md:text-4xl" style={{ letterSpacing: "-0.01em" }}>
              研究是核心，<br />AI 是杠杆。
            </h2>
          </div>
          <div className="space-y-6 text-[16px] leading-[1.9]" style={{ color: theme.inkSoft }}>
            <p>
              OPS Capital 是一家以研究为核心、以 AI 为杠杆的投资机构。我们的组合横跨美股科技、港股
              互联网、半导体供应链、加密资产与 Pre-IPO 市场。
            </p>
            <p>
              我们相信，好的投资是把资深研究员的 judgment 抽象为原则，再用系统与 AI 复制给整个团队——
              让好的决策可以扩展，让坏的决策在发生前就被识别。
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section
        id="philosophy"
        style={{ background: theme.ink, color: theme.bg }}
        className="px-6 py-24"
      >
        <div className="mx-auto max-w-[1200px]">
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
                <h3 className="mt-5 text-2xl" style={{ letterSpacing: "-0.01em" }}>{b.title}</h3>
                <p className="mt-4 text-[15px] leading-[1.9]" style={{ color: "#c8c2b4" }}>
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Approach */}
      <section id="approach" className="mx-auto max-w-[1200px] px-6 py-24">
        <p className="text-[11px] font-semibold tracking-[0.32em]" style={{ color: theme.gold }}>
          HOW WE INVEST
        </p>
        <h2 className="mt-4 text-3xl md:text-5xl" style={{ letterSpacing: "-0.01em" }}>
          三条方法论主轴
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {pillars.map((p, i) => (
            <article
              key={p.k}
              className="p-8"
              style={{ border: `1px solid ${theme.line}`, background: i === 1 ? theme.bgAlt : "transparent" }}
            >
              <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.muted }}>
                PILLAR {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-4 text-xl" style={{ letterSpacing: "-0.01em" }}>{p.k}</h3>
              <p className="mt-4 text-[14px] leading-[1.85]" style={{ color: theme.inkSoft }}>
                {p.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* OPS Alpha Channel */}
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
              OPS Alpha<br />
              <span style={{ color: theme.muted, fontSize: "0.6em", fontStyle: "italic" }}>
                AI 驱动的中文投研桌面
              </span>
            </h2>
            <p className="mt-6 max-w-xl text-[16px] leading-[1.9]" style={{ color: theme.inkSoft }}>
              OPS Alpha 是 OPS Capital 面向专业个人投资者开放的研究频道。我们把内部的 AI 研究流水线、
              标的聚合与估值框架整理成订阅制内容，让你以极低的成本获得机构级视角。
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
                <span
                  className="font-mono text-[12px] pt-1"
                  style={{ color: theme.gold, letterSpacing: "0.1em" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] leading-[1.75]" style={{ color: theme.ink }}>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer id="contact" style={{ background: theme.ink, color: theme.bg }} className="px-6 py-16">
        <div className="mx-auto max-w-[1200px] grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="flex items-baseline gap-2 text-[15px] font-bold tracking-[0.2em]">
              <span style={{ color: theme.gold }}>◆</span>
              <span>OPS CAPITAL</span>
            </p>
            <p className="mt-5 max-w-sm text-[14px] leading-[1.9]" style={{ color: "#c8c2b4" }}>
              OPS Capital is a research-driven investment firm. We combine disciplined principles
              with AI leverage to navigate cycles across global tech, HK internet, and digital assets.
            </p>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>CHANNELS</p>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "#d6d0c2" }}>
              <li><Link href="/alpha" className="hover:opacity-70">OPS Alpha · 投研桌面</Link></li>
              <li><Link href="/analysis" className="hover:opacity-70">分析长文</Link></li>
              <li><Link href="/news" className="hover:opacity-70">市场快讯</Link></li>
              <li><Link href="/pricing" className="hover:opacity-70">订阅方案</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>CONTACT</p>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "#d6d0c2" }}>
              <li>contact@opscapital.com</li>
              <li>Singapore · Hong Kong</li>
            </ul>
          </div>
        </div>
        <div className="mx-auto mt-12 max-w-[1200px] border-t pt-6 text-[11px]" style={{ borderColor: "#2a2a2a", color: "#8a857a" }}>
          © {new Date().getFullYear()} OPS Capital · 本站内容仅供投资研究参考，不构成任何买卖建议。投资有风险，决策需谨慎。
        </div>
      </footer>
    </main>
  );
}
