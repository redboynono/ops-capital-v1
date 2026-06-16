/**
 * FT 中文网式付费墙：真实正文读到 ~13% → 末段渐隐 →
 * 「您已阅读 X%（N 字），剩余 Y%（M 字）」→ 居中订阅卡。
 */

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PaywallSplit } from "@/lib/content-preview";
import { plansForProduct, type ProductLine } from "@/lib/payments/plans";

export function FtPaywallGate({
  split,
  loggedIn,
  loginRedirect,
  product = "research",
  locale = "zh",
  trialDays = 7,
}: {
  split: PaywallSplit;
  loggedIn: boolean;
  /** 登录后跳回的路径，如 /analysis/xxx */
  loginRedirect: string;
  product?: ProductLine;
  locale?: "zh" | "en";
  trialDays?: number;
}) {
  const en = locale === "en";
  const pricingHref = `/pricing?product=${product}`;
  const monthly = plansForProduct(product)[0];
  const monthlyPrice = monthly ? `$${(monthly.amount / 100).toFixed(2)}` : null;
  const memberName = product === "options"
    ? "Option Alpha"
    : en ? "Research Pro" : "Research Pro";

  // 被锁的「可执行」字段——让读者看到「就差这一步」，付费买的是可执行性
  const lockedFields = product === "options"
    ? (en
        ? ["Trade idea", "Strike & expiry", "Payoff / breakeven", "Position sizing"]
        : ["交易方案", "行权价 / 到期", "盈亏 / 盈亏平衡", "建议仓位"])
    : (en
        ? ["Target price", "Stop loss", "Position sizing", "Key catalysts"]
        : ["目标价", "止损位", "建议仓位", "关键催化剂"]);

  const t = {
    stats: en
      ? `You've read ${split.readPct}% (${split.readChars.toLocaleString("en-US")} chars). The remaining ${split.remainPct}% holds the actionable conclusions.`
      : null,
    lockedTitle: en ? "Members-only in this report" : "本报告会员专享字段",
    becomeMember: en ? `Unlock with ${memberName}` : `成为 ${memberName} 会员，阅读专享内容`,
    login: en ? "Already a member? Sign in" : "如您已经是会员，请点击这里登录",
    cta: en ? `Unlock — ${memberName}` : `成为 ${memberName} 会员 ▶`,
    trial: trialDays > 0
      ? (en
          ? `${trialDays}-day free trial · cancel anytime · ${monthlyPrice}/mo after`
          : `${trialDays} 天免费试用 · 随时取消 · 之后 ${monthlyPrice}/月起`)
      : (en ? `${monthlyPrice}/mo · instant access` : `${monthlyPrice}/月起 · 订阅立即生效`),
  };

  return (
    <div className="not-prose">
      {/* 免费预览（真实正文）+ 末段渐隐 */}
      <div className="ft-gate-preview prose prose-sm md:prose-base max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{split.previewMd}</ReactMarkdown>
        <div className="ft-gate-fade" aria-hidden />
      </div>

      {/* 阅读进度统计 */}
      <p className="ft-gate-stats">
        {en ? (
          <strong>{t.stats}</strong>
        ) : (
          <>
            <strong>
              您已阅读{split.readPct}%（{split.readChars.toLocaleString("zh-CN")}字），剩余{split.remainPct}%（
              {split.remainChars.toLocaleString("zh-CN")}字）包含更多重要信息，
            </strong>
            订阅以继续探索完整内容，并享受更多专属服务。
          </>
        )}
      </p>

      {/* 被锁的可执行字段（具体化价值） */}
      <div className="my-4 rounded-lg border border-accent/40 bg-accent-soft/40 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-strong">
          🔒 {t.lockedTitle}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {lockedFields.map((f) => (
            <div key={f} className="rounded border border-border bg-background/60 px-2 py-2 text-center">
              <p className="text-[11px] text-muted">{f}</p>
              <p className="mt-1 select-none font-mono text-[14px] font-bold tracking-widest text-foreground/30 blur-[2px]">
                ●●●
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 订阅卡 */}
      <div className="ft-gate-cta">
        <p className="ft-gate-cta-title">{t.becomeMember}</p>
        {!loggedIn ? (
          <p className="ft-gate-cta-login">
            <Link href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>{t.login}</Link>
          </p>
        ) : null}
        <Link href={pricingHref} className="ft-gate-cta-btn">
          {t.cta}
        </Link>
        {monthlyPrice ? <p className="ft-gate-cta-price">{t.trial}</p> : null}
      </div>
    </div>
  );
}
