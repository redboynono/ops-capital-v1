import Link from "next/link";
import type { TocItem } from "@/lib/markdown-toc";
import { plansForProduct, type ProductLine } from "@/lib/payments/plans";

/** 社会证明展示阈值：读者数低于此值则不展示，避免弱数字反向劝退 */
const SOCIAL_PROOF_MIN = 20;

/**
 * 非订阅用户看到的「摘要门」——Bloomberg 终端式 AI 摘要框。
 * 只展示核心结论 + 开头导语 + 被锁章节清单，不泄露正文与数据。
 * 锁定章节可点击，直达定价页诱导转化；CTA 含真实月费价格。
 */
export function ArticleSummaryGate({
  excerpt,
  teaser,
  sections,
  product = "research",
  readers = 0,
}: {
  /** 文章核心结论（post.excerpt） */
  excerpt: string;
  /** 开头导语纯文本预览 */
  teaser?: string | null;
  /** 全文章节（目录），用于展示「订阅后解锁 N 节」 */
  sections: TocItem[];
  /** 订阅产品线，用于定价页跳转 */
  product?: ProductLine;
  /** 本文去重阅读人数（社会证明） */
  readers?: number;
}) {
  const topSections = sections.filter((s) => s.level === 2);
  const lockedCount = topSections.length || sections.length;
  const pricingHref = `/pricing?product=${product}`;

  const monthly = plansForProduct(product)[0];
  const monthlyPrice = monthly ? `$${(monthly.amount / 100).toFixed(2)}` : null;
  const showSocialProof = readers >= SOCIAL_PROOF_MIN;

  return (
    <section className="ops-summary not-prose">
      <div className="ops-summary-head">
        <span className="ops-summary-badge">OPS AI 摘要</span>
        <span className="ops-summary-tag">免费预览 · 完整版需订阅</span>
      </div>

      {excerpt ? <p className="ops-summary-lede">{excerpt}</p> : null}
      {teaser ? <p className="ops-summary-teaser">{teaser}…</p> : null}

      {lockedCount > 0 ? (
        <div className="ops-summary-locked">
          <p className="ops-summary-locked-title">
            订阅后解锁完整 {lockedCount} 节深度分析与估值表
          </p>
          {topSections.length > 0 ? (
            <ul>
              {topSections.map((s) => (
                <li key={s.id}>
                  <Link href={pricingHref} className="ops-summary-locked-link">
                    {s.text}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="ops-summary-cta-row">
            <Link href={pricingHref} className="ops-summary-cta">
              立即解锁全文
              {monthlyPrice ? (
                <span className="ops-summary-cta-price">{monthlyPrice}/月起</span>
              ) : null}
            </Link>
            {showSocialProof ? (
              <span className="ops-summary-social">
                已有 {readers.toLocaleString("en-US")} 位投资者阅读本文
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
