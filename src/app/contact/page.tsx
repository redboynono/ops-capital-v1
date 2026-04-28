import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "联系我们 · OPS Capital" };

// 与首页同款配色
const theme = {
  bg: "#f5f1ea",
  bgAlt: "#ede7dc",
  ink: "#121212",
  inkSoft: "#3a3732",
  muted: "#6f6b64",
  gold: "#b08b57",
  line: "#d9d1c2",
};

const EMAIL = "steven.sun@opscapital.com";

const inquiryAreas = [
  {
    k: "订阅与开票",
    body: "OPS Alpha 会员开通、续期、发票申请、企业批量授权。",
  },
  {
    k: "媒体与合作",
    body: "采访、转载、活动邀请、内容互换、研究合作。",
  },
  {
    k: "投研与人才",
    body: "研究员 / 工程师候选人、学术合作、跨境投资项目。",
  },
];

export default async function ContactPage() {
  const user = await getSessionUser();
  const ctaLabel = user ? "打开 Alpha 工作台" : "进入 OPS Alpha";

  return (
    <main
      style={{
        background: theme.bg,
        color: theme.ink,
        fontFamily: '"Noto Serif SC", "Songti SC", Georgia, serif',
      }}
    >
      {/* Top nav (与首页一致) */}
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
            <Link href="/#philosophy" className="hover:opacity-70">理念</Link>
            <Link href="/#approach" className="hover:opacity-70">投资方式</Link>
            <Link href="/#alpha" className="hover:opacity-70">OPS Alpha</Link>
            <Link href="/contact" className="hover:opacity-70" style={{ color: theme.gold }}>
              联系
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-[13px]">
            {user ? (
              <Link
                href="/alpha"
                className="rounded-none px-4 py-2 font-semibold"
                style={{ background: theme.ink, color: theme.bg }}
              >
                {ctaLabel}
              </Link>
            ) : (
              <>
                <Link href="/login" className="hover:opacity-70" style={{ color: theme.inkSoft }}>
                  登录
                </Link>
                <Link
                  href="/alpha"
                  className="rounded-none px-4 py-2 font-semibold"
                  style={{ background: theme.ink, color: theme.bg }}
                >
                  {ctaLabel}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-[1200px]">
          <p
            className="text-[11px] tracking-[0.32em]"
            style={{ color: theme.gold }}
          >
            CONTACT
          </p>
          <h1
            className="mt-4 text-[44px] font-bold leading-[1.1] md:text-[64px]"
            style={{ color: theme.ink }}
          >
            与团队联系
          </h1>
          <p
            className="mt-6 max-w-[640px] text-[16px] leading-[1.9] md:text-[17px]"
            style={{ color: theme.inkSoft }}
          >
            OPS Capital 是一支以研究驱动的投资团队，常驻新加坡与香港。无论是订阅咨询、媒体合作还是投研讨论，
            我们都欢迎你直接来信。工作时间通常在 24 小时内回复。
          </p>
        </div>
      </section>

      {/* Email card */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-[1200px]">
          <div
            className="grid gap-10 p-10 md:grid-cols-[1.2fr_1fr] md:p-14"
            style={{ background: theme.ink, color: theme.bg }}
          >
            <div>
              <p
                className="text-[11px] tracking-[0.32em]"
                style={{ color: theme.gold }}
              >
                PRIMARY EMAIL
              </p>
              <a
                href={`mailto:${EMAIL}`}
                className="mt-4 block break-all text-[24px] font-bold tracking-tight underline-offset-4 hover:underline md:text-[32px]"
                style={{ color: theme.bg }}
              >
                {EMAIL}
              </a>
              <p
                className="mt-6 max-w-md text-[14px] leading-[1.85]"
                style={{ color: "#c8c2b4" }}
              >
                来信请简要说明背景、所在机构与具体需求。涉及订阅与发票事宜，建议附上注册邮箱与订单号以便加速处理。
              </p>
            </div>
            <div>
              <p
                className="text-[11px] tracking-[0.32em]"
                style={{ color: theme.gold }}
              >
                LOCATIONS
              </p>
              <ul className="mt-4 space-y-3 text-[15px]" style={{ color: "#d6d0c2" }}>
                <li className="flex items-baseline gap-3">
                  <span style={{ color: theme.gold }}>◆</span>
                  <span>Singapore</span>
                </li>
                <li className="flex items-baseline gap-3">
                  <span style={{ color: theme.gold }}>◆</span>
                  <span>Hong Kong</span>
                </li>
              </ul>
              <p
                className="mt-6 text-[12px] leading-[1.85]"
                style={{ color: "#8a857a" }}
              >
                工作日（一至五）GMT+8 时区  ·  周末与公共假期会延迟回复。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Inquiry areas */}
      <section className="px-6 py-16" style={{ background: theme.bgAlt }}>
        <div className="mx-auto max-w-[1200px]">
          <p
            className="text-[11px] tracking-[0.32em]"
            style={{ color: theme.gold }}
          >
            INQUIRY AREAS
          </p>
          <h2
            className="mt-3 text-[28px] font-bold md:text-[34px]"
            style={{ color: theme.ink }}
          >
            我们一般在以下话题上回复较快
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {inquiryAreas.map((a) => (
              <div key={a.k}>
                <p
                  className="text-[18px] font-bold"
                  style={{ color: theme.ink }}
                >
                  {a.k}
                </p>
                <p
                  className="mt-3 text-[14px] leading-[1.85]"
                  style={{ color: theme.muted }}
                >
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quicklinks */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-[1200px] grid gap-6 md:grid-cols-3">
          <Link
            href="/pricing"
            className="block border p-6 transition hover:opacity-80"
            style={{ borderColor: theme.line, color: theme.ink }}
          >
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>
              SUBSCRIBE
            </p>
            <p className="mt-3 text-[18px] font-bold">查看订阅方案 →</p>
            <p className="mt-2 text-[13px]" style={{ color: theme.muted }}>
              个人会员 / 季 / 年度方案，按月或按年付费。
            </p>
          </Link>
          <Link
            href="/alpha"
            className="block border p-6 transition hover:opacity-80"
            style={{ borderColor: theme.line, color: theme.ink }}
          >
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>
              PRODUCT
            </p>
            <p className="mt-3 text-[18px] font-bold">体验 OPS Alpha →</p>
            <p className="mt-2 text-[13px]" style={{ color: theme.muted }}>
              投研桌面 · 自选股 · 阅读历史 · 实时分析。
            </p>
          </Link>
          <Link
            href="/analysis"
            className="block border p-6 transition hover:opacity-80"
            style={{ borderColor: theme.line, color: theme.ink }}
          >
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>
              RESEARCH
            </p>
            <p className="mt-3 text-[18px] font-bold">阅读分析长文 →</p>
            <p className="mt-2 text-[13px]" style={{ color: theme.muted }}>
              机构级分析 · 估值模型 · 月度观察。
            </p>
          </Link>
        </div>
      </section>

      {/* Footer (与首页保持一致) */}
      <footer
        style={{ background: theme.ink, color: theme.bg }}
        className="px-6 py-16"
      >
        <div className="mx-auto max-w-[1200px] grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="flex items-baseline gap-2 text-[15px] font-bold tracking-[0.2em]">
              <span style={{ color: theme.gold }}>◆</span>
              <span>OPS CAPITAL</span>
            </p>
            <p
              className="mt-5 max-w-sm text-[14px] leading-[1.9]"
              style={{ color: "#c8c2b4" }}
            >
              OPS Capital is a research-driven investment firm. We combine disciplined principles
              with AI leverage to navigate cycles across global tech, HK internet, and digital assets.
            </p>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>
              CHANNELS
            </p>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "#d6d0c2" }}>
              <li>
                <Link href="/alpha" className="hover:opacity-70">OPS Alpha · 投研桌面</Link>
              </li>
              <li>
                <Link href="/analysis" className="hover:opacity-70">分析长文</Link>
              </li>
              <li>
                <Link href="/news" className="hover:opacity-70">市场快讯</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:opacity-70">订阅方案</Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.32em]" style={{ color: theme.gold }}>
              CONTACT
            </p>
            <ul className="mt-4 space-y-2 text-[14px]" style={{ color: "#d6d0c2" }}>
              <li>
                <a href={`mailto:${EMAIL}`} className="hover:opacity-70">{EMAIL}</a>
              </li>
              <li>Singapore · Hong Kong</li>
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
