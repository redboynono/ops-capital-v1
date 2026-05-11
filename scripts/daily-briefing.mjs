#!/usr/bin/env node
/**
 * OPS Alpha · 每日个性化简报生成器
 * ------------------------------------------------------------
 * 为每个 watchlist 非空的用户生成一份 Markdown 简报，写入 daily_briefings。
 * 若用户 email_briefing_enabled=1，再通过 Resend 发邮件。
 *
 * 内容（基于 watchlist 自动汇总，零 LLM 调用）：
 *   1. 隔夜涨跌榜（按 |dp%| 倒序）— Finnhub /quote
 *   2. 各标的近 24 小时 news headlines — Finnhub /company-news（每只 ≤3 条）
 *   3. 未来 7 天财报日历交集
 *   4. 过去 24 小时 OPS Alpha 新文章触及的 watchlist 标的
 *
 * 用法：
 *   docker cp /data/ops-alpha/scripts/daily-briefing.mjs ops-alpha:/app/daily-briefing.mjs
 *   docker exec -w /app ops-alpha node daily-briefing.mjs [--dry-run] [--user=<email>]
 */

import mysql from "mysql2/promise";
import crypto from "node:crypto";
import { runJob } from "./lib/job-runner.mjs";

// ============================== args ============================== //

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? "true"] : [a, "true"];
  }),
);
const DRY_RUN = args["dry-run"] === "true";
const USER_FILTER = args.user ?? null;

// ============================== config ============================== //

const MYSQL_URL = process.env.MYSQL_URL;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY ?? process.env.FINNHUB_TOKEN ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM_EMAIL ?? "";
const SITE_URL = process.env.SITE_URL ?? "https://opscapital.com";

// AI 总结（可选；缺 key 时跳过 LLM 改写，保持纯模板）
const AI_KEY = process.env.OPENAI_API_KEY ?? "";
const AI_BASE = (process.env.OPENAI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai").replace(/\/$/, "");
const AI_MODEL = process.env.OPENAI_MODEL ?? "gemini-3.1-pro-preview";

if (!MYSQL_URL) throw new Error("MYSQL_URL not set");
if (!FINNHUB_API_KEY && !DRY_RUN) throw new Error("FINNHUB_API_KEY not set");

const todayISO = () => new Date().toISOString().slice(0, 10);
const yesterdayISO = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// ============================== finnhub helpers ============================== //

async function fhGet(path, query = {}) {
  if (!FINNHUB_API_KEY) return null;
  const u = new URL(`https://finnhub.io/api/v1/${path}`);
  for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
  u.searchParams.set("token", FINNHUB_API_KEY);
  try {
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getQuote(symbol) {
  const q = await fhGet("quote", { symbol });
  if (!q || !Number.isFinite(Number(q.c)) || Number(q.c) === 0) return null;
  return {
    c: Number(q.c),
    d: q.d == null ? null : Number(q.d),
    dp: q.dp == null ? null : Number(q.dp),
    h: Number(q.h ?? 0),
    l: Number(q.l ?? 0),
    pc: Number(q.pc ?? 0),
  };
}

async function getNews(symbol, fromISO, toISO) {
  const data = await fhGet("company-news", { symbol, from: fromISO, to: toISO });
  if (!Array.isArray(data)) return [];
  return data
    .filter((n) => n.headline)
    .slice(0, 3)
    .map((n) => ({
      headline: String(n.headline).slice(0, 200),
      url: n.url,
      source: n.source ?? "",
      datetime: Number(n.datetime ?? 0),
    }));
}

// ============================== AI summary ============================== //

/**
 * 让 Gemini 把当日 watchlist 的数据浓缩成 2-3 句中文开场白：
 *   - 必须 grounded 在传入的事实里，不许臆造
 *   - 没有"投资建议"语气，只点出"今天值得注意的事"
 *   - 失败/超时返回 null，调用方退回模板版
 */
async function generateAiIntro(facts) {
  if (!AI_KEY) return null;
  const prompt = `# Role
你是 OPS Alpha 投研终端的"今日要点"编辑。

# 任务
基于下面的 facts JSON，写 2-3 句中文的开场白，给一个有 ${facts.watchlist_size} 只自选股的用户看。

# 要求
- **只能用 facts 里的数字 / 名字**。禁止臆测 / 引用未出现的事件。
- 优先级：财报今天/明天 > 大幅价格变动 (|dp%| ≥ 3) > 新闻动量 > OPS 平台新文章
- 直击重点，不写"早上好"、"投资有风险"这种废话
- 如果是平淡的一天，就直说"今日自选无显著事件"
- 控制在 80-150 个汉字内
- 直接输出文本，不要 Markdown 标题，不要 bullet

# Facts (JSON)
${JSON.stringify(facts, null, 0)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(`${AI_BASE}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.4,
        max_tokens: Number(process.env.OPENAI_BRIEFING_MAX_TOKENS ?? 4000),
        messages: [
          { role: "system", content: "你是数据驱动的二级市场编辑。简短、精准、不臆测。" },
          { role: "user", content: prompt },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = await res.json();
    const raw = j?.choices?.[0]?.message?.content ?? "";
    const cleaned = String(raw).replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
    if (!cleaned || cleaned.length < 10) return null;
    return cleaned;
  } catch {
    return null;
  }
}

// ============================== content builder ============================== //

function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}
function fmtPrice(v) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
}

async function buildBriefingForUser(conn, user, today) {
  // 1) 拉 watchlist
  const [watchRows] = await conn.execute(
    `select w.symbol, t.name, t.exchange, t.sector
       from watchlist w
       inner join tickers t on t.symbol = w.symbol
      where w.user_id = ?
      order by w.created_at desc`,
    [user.id],
  );
  if (watchRows.length === 0) return null;
  const symbols = watchRows.map((r) => r.symbol);

  // 2) 并行拉 quote + news
  const from = yesterdayISO();
  const to = today;
  const enriched = await Promise.all(
    watchRows.map(async (t) => {
      const [quote, news] = await Promise.all([getQuote(t.symbol), getNews(t.symbol, from, to)]);
      return { ...t, quote, news };
    }),
  );

  // 3) 找未来 7 天财报
  const in7d = new Date(today);
  in7d.setUTCDate(in7d.getUTCDate() + 7);
  const upcomingISO = in7d.toISOString().slice(0, 10);
  const placeholders = symbols.map(() => "?").join(",");
  const [earningsRows] = await conn.execute(
    `select symbol, cast(report_date as char) as report_date, hour, fiscal_year, fiscal_quarter
       from earnings_releases
      where symbol in (${placeholders})
        and report_date between ? and ?
        and eps_actual is null
      order by report_date asc, symbol`,
    [...symbols, today, upcomingISO],
  );

  // 4) 找过去 24h 平台新文章触及 watchlist 标的
  const [postRows] = await conn.execute(
    `select distinct p.id, p.title, p.slug, p.kind, p.created_at,
            group_concat(distinct pt.symbol order by pt.symbol) as symbols
       from posts p
       inner join post_tickers pt on pt.post_id = p.id
      where pt.symbol in (${placeholders})
        and p.created_at >= date_sub(current_timestamp, interval 26 hour)
      group by p.id, p.title, p.slug, p.kind, p.created_at
      order by p.created_at desc
      limit 8`,
    symbols,
  );

  // ========== 让 Gemini 写 2-3 句开场白 ==========
  const facts = {
    date: today,
    watchlist_size: watchRows.length,
    movers: enriched
      .filter((e) => e.quote)
      .map((e) => ({
        symbol: e.symbol,
        name: e.name,
        price: e.quote.c,
        dp: e.quote.dp,
      }))
      .sort((a, b) => Math.abs(b.dp ?? 0) - Math.abs(a.dp ?? 0))
      .slice(0, 8),
    news_count_by_symbol: enriched
      .filter((e) => e.news.length > 0)
      .map((e) => ({
        symbol: e.symbol,
        n: e.news.length,
        top_headline: e.news[0]?.headline ?? null,
      })),
    upcoming_earnings: earningsRows.map((r) => ({
      symbol: r.symbol,
      date: r.report_date,
      hour: r.hour,
    })),
    new_ops_articles: postRows.map((p) => ({
      title: p.title,
      kind: p.kind,
      symbols: p.symbols,
    })),
  };
  const aiIntro = await generateAiIntro(facts);

  // ========== render markdown ==========
  const md = [];
  const dateLabel = today.replace(/-/g, "/");
  md.push(`# 今日简报 · ${dateLabel}`);
  md.push("");
  if (aiIntro) {
    md.push("## 今日要点");
    md.push("");
    md.push(aiIntro);
    md.push("");
    md.push(`*自选清单 ${watchRows.length} 个标的 · 详情见下方分区。*`);
    md.push("");
  } else {
    md.push(`你的自选清单 **${watchRows.length} 个标的** · 自动汇总，无需通读市场。`);
    md.push("");
  }

  // -- Section 1: price movers
  const withQuote = enriched.filter((e) => e.quote);
  if (withQuote.length > 0) {
    const sorted = [...withQuote].sort(
      (a, b) => Math.abs(b.quote.dp ?? 0) - Math.abs(a.quote.dp ?? 0),
    );
    md.push("## 隔夜涨跌");
    md.push("");
    for (const e of sorted) {
      const dp = e.quote.dp;
      const arrow = dp == null ? "·" : dp > 0 ? "↑" : dp < 0 ? "↓" : "·";
      md.push(
        `- **${e.symbol}** ${e.name ? `(${e.name})` : ""} — ${fmtPrice(e.quote.c)} ${arrow} ${fmtPct(dp)} · 前收 ${fmtPrice(e.quote.pc)}`,
      );
    }
    md.push("");
  }

  // -- Section 2: news
  const withNews = enriched.filter((e) => e.news.length > 0);
  if (withNews.length > 0) {
    md.push("## 自选标的近 24 小时 news");
    md.push("");
    for (const e of withNews) {
      md.push(`### ${e.symbol}`);
      for (const n of e.news) {
        const dt = n.datetime
          ? new Date(n.datetime * 1000).toISOString().slice(0, 16).replace("T", " ")
          : "";
        md.push(`- [${n.headline}](${n.url}) — ${n.source}${dt ? ` · ${dt}` : ""}`);
      }
      md.push("");
    }
  }

  // -- Section 3: OPS Alpha new posts
  if (postRows.length > 0) {
    md.push("## OPS Alpha 新文章");
    md.push("");
    for (const p of postRows) {
      const kindLabel = p.kind === "news" ? "快讯" : "分析";
      const path = p.kind === "news" ? "news" : "analysis";
      md.push(
        `- [${kindLabel}] [${p.title}](${SITE_URL}/${path}/${p.slug}) — \`${p.symbols ?? ""}\``,
      );
    }
    md.push("");
  }

  // -- Section 4: upcoming earnings
  if (earningsRows.length > 0) {
    md.push("## 未来 7 天财报");
    md.push("");
    for (const r of earningsRows) {
      const hour = r.hour === "bmo" ? "盘前" : r.hour === "amc" ? "盘后" : r.hour ? r.hour : "—";
      md.push(`- **${r.report_date}** · ${r.symbol} · FY${r.fiscal_year} Q${r.fiscal_quarter} · ${hour}`);
    }
    md.push("");
  }

  // -- Footer
  if (withNews.length === 0 && postRows.length === 0 && earningsRows.length === 0) {
    md.push("> 今日自选清单暂无显著事件 / 新闻 / 财报。可在 [对比工具](${SITE_URL}/compare) 或 [选股器](${SITE_URL}/screener) 寻找新机会。");
    md.push("");
  } else {
    md.push("---");
    md.push("");
    md.push(`> 完整自选清单 → [/dashboard/watchlist](${SITE_URL}/dashboard/watchlist) · 选股 → [/screener](${SITE_URL}/screener)`);
  }

  return { content: md.join("\n"), tickerCount: watchRows.length };
}

// ============================== email helper ============================== //

function markdownToHtml(md) {
  // 极简 markdown → html，只处理我们用到的语法
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  html = html
    .replace(/^# (.+)$/gm, '<h2 style="margin:24px 0 8px;font-size:18px;color:#c2462a">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="margin:18px 0 6px;font-size:15px;color:#111827">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="margin:12px 0 4px;font-size:13px;color:#374151">$1</h4>')
    .replace(/^---$/gm, '<hr style="border:0;border-top:1px solid #e5e7eb;margin:16px 0" />')
    .replace(/^&gt; (.+)$/gm, '<p style="margin:8px 0;padding:6px 12px;border-left:3px solid #d1d5db;color:#6b7280;font-size:12px">$1</p>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:2px;font-size:11px">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#c2462a;text-decoration:none">$1</a>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;font-size:13px;line-height:1.6">$1</li>');
  // wrap consecutive <li> into <ul>
  html = html.replace(/(<li[\s\S]*?<\/li>(?:\s*<li[\s\S]*?<\/li>)*)/g, '<ul style="margin:6px 0;padding-left:20px;list-style:disc">$1</ul>');
  // paragraphs from remaining non-tagged lines
  html = html
    .split(/\n\n+/)
    .map((block) => {
      if (block.match(/^\s*<(h\d|ul|hr|p)/)) return block;
      if (!block.trim()) return "";
      return `<p style="margin:6px 0;font-size:13px;line-height:1.6;color:#1f2937">${block.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
  return html;
}

async function sendBriefingEmail({ to, content, dateLabel }) {
  if (!RESEND_API_KEY || !RESEND_FROM) return false;
  const body = markdownToHtml(content);
  const html = `<div style="font-family:-apple-system,'PingFang SC',Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827">
    <div style="border-bottom:1px solid #e5e7eb;padding-bottom:12px;margin-bottom:16px">
      <p style="margin:0;font-size:11px;color:#9ca3af;letter-spacing:0.05em">OPS ALPHA · DAILY BRIEFING</p>
      <p style="margin:4px 0 0;font-size:13px;color:#6b7280">${dateLabel}</p>
    </div>
    ${body}
    <p style="margin:24px 0 0;padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px">
      你正在接收 OPS Alpha 自选股每日简报。<br/>
      取消订阅：<a href="${SITE_URL}/dashboard/profile" style="color:#9ca3af">/dashboard/profile</a>
    </p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject: `OPS Alpha · ${dateLabel} 自选股简报`,
      html,
    }),
  });
  return res.ok;
}

// ============================== main ============================== //

async function main(ctx) {
  const conn = await mysql.createConnection(MYSQL_URL);
  const today = todayISO();

  // 找所有 watchlist 非空的用户
  let userSql = `select u.id, u.email, u.email_briefing_enabled
                   from users u
                  where exists (select 1 from watchlist w where w.user_id = u.id)`;
  const params = [];
  if (USER_FILTER) {
    userSql += " and u.email = ?";
    params.push(USER_FILTER);
  }
  const [users] = await conn.execute(userSql, params);

  console.log(`[daily-briefing] target users: ${users.length}, today=${today}, dry=${DRY_RUN}`);

  let made = 0;
  let mailed = 0;
  for (const u of users) {
    try {
      const result = await buildBriefingForUser(conn, u, today);
      if (!result) {
        console.log(`  · ${u.email} — no watchlist, skip`);
        continue;
      }
      made++;
      if (DRY_RUN) {
        console.log(`  · ${u.email} — ${result.tickerCount} tickers · would write briefing (${result.content.length} chars)`);
        continue;
      }
      // upsert
      const id = crypto.randomUUID();
      await conn.execute(
        `insert into daily_briefings (id, user_id, brief_date, content_markdown, ticker_count)
         values (?, ?, ?, ?, ?)
         on duplicate key update
           content_markdown = values(content_markdown),
           ticker_count = values(ticker_count),
           email_sent_at = null`,
        [id, u.id, today, result.content, result.tickerCount],
      );
      const [rows] = await conn.execute(
        "select id from daily_briefings where user_id = ? and brief_date = ? limit 1",
        [u.id, today],
      );
      const briefingId = rows[0]?.id ?? id;
      console.log(`  · ${u.email} — wrote briefing (${result.tickerCount} tickers)`);

      // email
      if (u.email_briefing_enabled === 1 && RESEND_API_KEY) {
        const ok = await sendBriefingEmail({
          to: u.email,
          content: result.content,
          dateLabel: today,
        });
        if (ok) {
          await conn.execute("update daily_briefings set email_sent_at = current_timestamp where id = ?", [briefingId]);
          mailed++;
          console.log(`    ↳ email sent`);
          await conn
            .execute(
              `insert into events (event_type, user_id, meta_json) values (?, ?, ?)`,
              ["briefing_email_sent", u.id, JSON.stringify({ tickerCount: result.tickerCount })],
            )
            .catch(() => {});
        } else {
          console.log(`    ↳ email FAILED`);
        }
      }
    } catch (err) {
      console.error(`  ✗ ${u.email} failed:`, err.message);
    }
  }

  console.log(`[daily-briefing] done. briefings=${made}, emails=${mailed}`);
  await conn.end();

  if (ctx) {
    ctx.itemsTotal = users.length;
    ctx.itemsOk = made;
    ctx.itemsFailed = users.length - made;
    ctx.meta = { mailed, dryRun: DRY_RUN, userFilter: USER_FILTER };
  }
}

runJob({ jobName: "daily-briefing", mysqlUrl: MYSQL_URL }, main).catch((e) => {
  console.error("[daily-briefing] FATAL:", e);
  process.exit(1);
});
