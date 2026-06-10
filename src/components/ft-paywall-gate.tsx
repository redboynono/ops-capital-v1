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
}: {
  split: PaywallSplit;
  loggedIn: boolean;
  /** 登录后跳回的路径，如 /analysis/xxx */
  loginRedirect: string;
  product?: ProductLine;
}) {
  const pricingHref = `/pricing?product=${product}`;
  const monthly = plansForProduct(product)[0];
  const monthlyPrice = monthly ? `$${(monthly.amount / 100).toFixed(2)}/月起` : null;
  const memberName = product === "options" ? "Option Alpha 会员" : "Research Pro 会员";

  return (
    <div className="not-prose">
      {/* 免费预览（真实正文）+ 末段渐隐 */}
      <div className="ft-gate-preview prose prose-sm md:prose-base max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{split.previewMd}</ReactMarkdown>
        <div className="ft-gate-fade" aria-hidden />
      </div>

      {/* 阅读进度统计 */}
      <p className="ft-gate-stats">
        <strong>
          您已阅读{split.readPct}%（{split.readChars.toLocaleString("zh-CN")}字），剩余{split.remainPct}%（
          {split.remainChars.toLocaleString("zh-CN")}字）包含更多重要信息，
        </strong>
        订阅以继续探索完整内容，并享受更多专属服务。
      </p>

      {/* 订阅卡 */}
      <div className="ft-gate-cta">
        <p className="ft-gate-cta-title">成为{memberName}，阅读会员专享内容</p>
        {!loggedIn ? (
          <p className="ft-gate-cta-login">
            如您已经是会员，
            <Link href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}>请点击这里登录</Link>
          </p>
        ) : null}
        <Link href={pricingHref} className="ft-gate-cta-btn">
          成为{memberName} ▶
        </Link>
        {monthlyPrice ? <p className="ft-gate-cta-price">{monthlyPrice} · 订阅立即生效 · 时长可叠加</p> : null}
      </div>
    </div>
  );
}
