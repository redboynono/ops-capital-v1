/**
 * Rating change detection for cron scripts (mirrors src/lib/rating-changes.ts).
 */

const VERDICT_ZH = {
  STRONG_BUY: "强买",
  BUY: "买入",
  HOLD: "持有",
  SELL: "卖出",
  STRONG_SELL: "强卖",
};

const FACTOR_ZH = {
  VALUATION: "估值",
  GROWTH: "成长",
  PROFITABILITY: "盈利",
  MOMENTUM: "动能",
  REVISIONS: "上调",
};

function fmtVerdict(v) {
  if (!v) return "—";
  return VERDICT_ZH[v] ?? v;
}

export async function listRatingChangesForSymbols(conn, symbols, sinceHours = 48) {
  if (!symbols.length) return [];
  const ph = symbols.map(() => "?").join(",");
  const changes = [];

  const [ratingRows] = await conn.execute(
    `select h.symbol, t.name, h.ops_verdict, h.quant_score, h.ops_target_price,
            h.captured_at,
            row_number() over (partition by h.symbol order by h.captured_at desc) as rn
       from ticker_ratings_history h
       inner join tickers t on t.symbol = h.symbol
      where h.captured_at >= date_sub(now(), interval ? hour)
        and h.symbol in (${ph})`,
    [sinceHours, ...symbols],
  );

  const bySym = new Map();
  for (const r of ratingRows) {
    if (!bySym.has(r.symbol)) bySym.set(r.symbol, []);
    bySym.get(r.symbol).push(r);
  }

  for (const [symbol, rows] of bySym) {
    const latest = rows.find((r) => Number(r.rn) === 1);
    const prev = rows.find((r) => Number(r.rn) === 2);
    if (!latest || !prev) continue;
    if (latest.ops_verdict && prev.ops_verdict && latest.ops_verdict !== prev.ops_verdict) {
      changes.push({
        symbol,
        name: latest.name,
        label: "OPS 观点",
        from_value: fmtVerdict(prev.ops_verdict),
        to_value: fmtVerdict(latest.ops_verdict),
      });
    }
    const q0 = prev.quant_score != null ? Number(prev.quant_score) : null;
    const q1 = latest.quant_score != null ? Number(latest.quant_score) : null;
    if (q0 != null && q1 != null && Math.abs(q1 - q0) >= 0.15) {
      changes.push({
        symbol,
        name: latest.name,
        label: "Quant 分",
        from_value: q0.toFixed(2),
        to_value: q1.toFixed(2),
      });
    }
  }

  const [fgRows] = await conn.execute(
    `select h.symbol, t.name, h.factor, h.grade, h.captured_at,
            row_number() over (partition by h.symbol, h.factor order by h.captured_at desc) as rn
       from ticker_factor_grades_history h
       inner join tickers t on t.symbol = h.symbol
      where h.captured_at >= date_sub(now(), interval ? hour)
        and h.symbol in (${ph})`,
    [sinceHours, ...symbols],
  );

  const fgMap = new Map();
  for (const r of fgRows) {
    const k = `${r.symbol}:${r.factor}`;
    if (!fgMap.has(k)) fgMap.set(k, []);
    fgMap.get(k).push(r);
  }
  for (const [, rows] of fgMap) {
    const latest = rows.find((r) => Number(r.rn) === 1);
    const prev = rows.find((r) => Number(r.rn) === 2);
    if (!latest || !prev || latest.grade === prev.grade) continue;
    changes.push({
      symbol: latest.symbol,
      name: latest.name,
      label: `因子 ${FACTOR_ZH[latest.factor] ?? latest.factor}`,
      from_value: prev.grade,
      to_value: latest.grade,
    });
  }

  return changes;
}

export function ratingChangesMarkdown(changes, siteUrl) {
  if (!changes.length) return "";
  const lines = ["## OPS 评级变动（自选）", ""];
  for (const c of changes.slice(0, 12)) {
    lines.push(
      `- **${c.symbol}** ${c.label}：${c.from_value} → **${c.to_value}** · [详情](${siteUrl}/t/${c.symbol})`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
