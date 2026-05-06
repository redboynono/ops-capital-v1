/**
 * Bloomberg-style preview paywall.
 *
 * Instead of hard-truncating the article, we render the FULL body and
 * blur out value-bearing numbers (prices, percentages, multiples).
 * Non-subscribers see the structure, headlines, narrative — but the
 * key data is redacted, creating a "show me the rest" instinct that
 * converts much better than a hard cutoff at N chars.
 */

import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ---------------------------------------------------------------------
// Patterns of "value-bearing" numbers that we hide behind the paywall.
// We deliberately keep year tokens (2024 / 2026) and standalone small
// numbers visible so prose stays readable.
// ---------------------------------------------------------------------
const MONEY_USD = String.raw`\$[\d,]+(?:\.\d+)?(?:\s?[BMK])?`;          // $170, $1.2B
const MONEY_CNY = String.raw`(?:¥|￥|RMB\s?)[\d,]+(?:\.\d+)?`;          // ¥1.2万
const PERCENT = String.raw`[+\-]?\d+(?:\.\d+)?\s?%`;                    // +24%, -5.3%
const CN_BIG = String.raw`\d+(?:\.\d+)?\s?(?:亿|万亿|千万|百万|万)`;    // 1.2亿, 5千万
const MULTIPLE = String.raw`\d+(?:\.\d+)?\s?(?:倍|x|×)\b`;              // 32倍, 12x
const EPS_LIKE = String.raw`(?:EPS|营收|净利|毛利|净利率|毛利率|ROE|ROIC|FCF)\s*[:：]?\s*[\$¥￥]?\d+(?:\.\d+)?[BMK%]?`;

const REDACT_RE = new RegExp(
  `(${EPS_LIKE}|${MONEY_USD}|${MONEY_CNY}|${PERCENT}|${CN_BIG}|${MULTIPLE})`,
  "gu",
);

// ---------------------------------------------------------------------
// Recursively walk ReactMarkdown children, replace every text-node match
// with a `<span class="ops-blur">…</span>`.
// ---------------------------------------------------------------------
function redactString(text: string): ReactNode {
  if (!text) return text;
  REDACT_RE.lastIndex = 0;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(REDACT_RE)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) parts.push(text.slice(lastIndex, idx));
    parts.push(
      <span key={`b-${idx}`} className="ops-blur" title="Premium 解锁后查看" data-paywall="1">
        {m[0]}
      </span>,
    );
    lastIndex = idx + m[0].length;
  }
  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function redactChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") return redactString(child);
    if (typeof child === "number") return redactString(String(child));
    return child;
  });
}

// ---------------------------------------------------------------------
// Drop-in replacement for `<ReactMarkdown>{md}</ReactMarkdown>`.
// When `redact` is true, all text content within block elements has its
// numeric tokens replaced with blurred spans. When false, behaves like
// ordinary ReactMarkdown.
// ---------------------------------------------------------------------
export function RedactedMarkdown({ children, redact }: { children: string; redact: boolean }) {
  if (!redact) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children: c }) => <p>{redactChildren(c)}</p>,
        li: ({ children: c }) => <li>{redactChildren(c)}</li>,
        strong: ({ children: c }) => <strong>{redactChildren(c)}</strong>,
        em: ({ children: c }) => <em>{redactChildren(c)}</em>,
        td: ({ children: c }) => <td>{redactChildren(c)}</td>,
        th: ({ children: c }) => <th>{redactChildren(c)}</th>,
        h1: ({ children: c }) => <h1>{redactChildren(c)}</h1>,
        h2: ({ children: c }) => <h2>{redactChildren(c)}</h2>,
        h3: ({ children: c }) => <h3>{redactChildren(c)}</h3>,
        h4: ({ children: c }) => <h4>{redactChildren(c)}</h4>,
        blockquote: ({ children: c }) => <blockquote>{redactChildren(c)}</blockquote>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

/**
 * Standalone helper for blurring a short value (e.g., target_price in a card).
 * Pass `value` as already-formatted string ("$170.00", "+24.5%").
 */
export function MaybeBlur({ value, redact }: { value: string | null | undefined; redact: boolean }) {
  if (value == null || value === "" || value === "—") return <>{value ?? "—"}</>;
  if (!redact) return <>{value}</>;
  return (
    <span className="ops-blur" title="Premium 解锁后查看" data-paywall="1">
      {value}
    </span>
  );
}

/**
 * Approximate the count of redacted tokens in an article body.
 * Used for "🔒 含 14 处 Premium 数据" hint above the paywall CTA.
 */
export function countRedactions(md: string): number {
  REDACT_RE.lastIndex = 0;
  let n = 0;
  for (const _ of md.matchAll(REDACT_RE)) n++;
  return n;
}
