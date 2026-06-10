import { mysqlQuery } from "@/lib/mysql";
import type { Verdict } from "@/lib/ratings";

export type RatingChangeKind =
  | "ops_verdict"
  | "quant_score"
  | "ops_target"
  | "factor_grade";

export type RatingChange = {
  symbol: string;
  name: string;
  kind: RatingChangeKind;
  field: string;
  label: string;
  from_value: string | null;
  to_value: string | null;
  captured_at: string;
  ai_note?: string | null;
};

const VERDICT_ZH: Record<string, string> = {
  STRONG_BUY: "强买",
  BUY: "买入",
  HOLD: "持有",
  SELL: "卖出",
  STRONG_SELL: "强卖",
};

const FACTOR_ZH: Record<string, string> = {
  VALUATION: "估值",
  GROWTH: "成长",
  PROFITABILITY: "盈利",
  MOMENTUM: "动能",
  REVISIONS: "上调",
};

function fmtVerdict(v: string | null) {
  if (!v) return "—";
  return VERDICT_ZH[v] ?? v;
}

/** 检测评级 / 因子在近 N 小时内的变动（对比最近两次快照）。 */
export async function listRecentRatingChanges(opts: {
  symbols?: string[];
  sinceHours?: number;
  limit?: number;
} = {}): Promise<RatingChange[]> {
  const sinceHours = opts.sinceHours ?? 72;
  const limit = opts.limit ?? 50;
  const symbolFilter = opts.symbols?.length
    ? `and h.symbol in (${opts.symbols.map(() => "?").join(",")})`
    : "";
  const symParams = opts.symbols ?? [];

  type RhRow = {
    symbol: string;
    name: string;
    ops_verdict: Verdict | null;
    quant_score: string | null;
    ops_target_price: string | null;
    captured_at: string;
    rn: number;
  };

  const ratingRows = await mysqlQuery<RhRow[]>(
    `with ranked as (
       select h.symbol, t.name, h.ops_verdict, h.quant_score, h.ops_target_price,
              cast(h.captured_at as char) as captured_at,
              row_number() over (partition by h.symbol order by h.captured_at desc) as rn
         from ticker_ratings_history h
         inner join tickers t on t.symbol = h.symbol
         ${opts.symbols?.length ? `where h.symbol in (${opts.symbols.map(() => "?").join(",")})` : ""}
     )
     select * from ranked where rn <= 2`,
    symParams,
  );

  const changes: RatingChange[] = [];
  const bySym = new Map<string, RhRow[]>();
  for (const r of ratingRows) {
    const arr = bySym.get(r.symbol) ?? [];
    arr.push(r);
    bySym.set(r.symbol, arr);
  }

  for (const [symbol, rows] of bySym) {
    const sorted = rows.sort((a, b) => Number(a.rn) - Number(b.rn));
    const latest = sorted.find((r) => Number(r.rn) === 1);
    const prev = sorted.find((r) => Number(r.rn) === 2);
    if (!latest) continue;

    // Filter by sinceHours on the latest snapshot
    const latestTime = new Date(latest.captured_at).getTime();
    if (latestTime < Date.now() - sinceHours * 3600 * 1000) {
      continue;
    }

    const name = latest.name;

    // 首次覆盖 (Initiated)
    if (!prev) {
      if (latest.ops_verdict) {
        changes.push({
          symbol,
          name,
          kind: "ops_verdict",
          field: "ops_verdict",
          label: "首次覆盖",
          from_value: "—",
          to_value: fmtVerdict(latest.ops_verdict),
          captured_at: latest.captured_at,
        });
      }
      continue;
    }

    if (latest.ops_verdict && prev.ops_verdict && latest.ops_verdict !== prev.ops_verdict) {
      changes.push({
        symbol,
        name,
        kind: "ops_verdict",
        field: "ops_verdict",
        label: "OPS 观点",
        from_value: fmtVerdict(prev.ops_verdict),
        to_value: fmtVerdict(latest.ops_verdict),
        captured_at: latest.captured_at,
      });
    }

    const q0 = prev.quant_score != null ? Number(prev.quant_score) : null;
    const q1 = latest.quant_score != null ? Number(latest.quant_score) : null;
    if (q0 != null && q1 != null && Math.abs(q1 - q0) >= 0.15) {
      changes.push({
        symbol,
        name,
        kind: "quant_score",
        field: "quant_score",
        label: "Quant 分",
        from_value: q0.toFixed(2),
        to_value: q1.toFixed(2),
        captured_at: latest.captured_at,
      });
    }

    const t0 = prev.ops_target_price != null ? Number(prev.ops_target_price) : null;
    const t1 = latest.ops_target_price != null ? Number(latest.ops_target_price) : null;
    if (t0 != null && t1 != null && Math.abs(t1 - t0) / t0 >= 0.03) {
      changes.push({
        symbol,
        name,
        kind: "ops_target",
        field: "ops_target_price",
        label: "OPS 目标价",
        from_value: `$${t0.toFixed(2)}`,
        to_value: `$${t1.toFixed(2)}`,
        captured_at: latest.captured_at,
      });
    }
  }

  type FgRow = {
    symbol: string;
    name: string;
    factor: string;
    grade: string;
    captured_at: string;
    rn: number;
  };

  const fgRows = await mysqlQuery<FgRow[]>(
    `select h.symbol, t.name, h.factor, h.grade,
            cast(h.captured_at as char) as captured_at,
            row_number() over (partition by h.symbol, h.factor order by h.captured_at desc) as rn
       from ticker_factor_grades_history h
       inner join tickers t on t.symbol = h.symbol
      where h.captured_at >= date_sub(now(), interval ? hour)
        ${symbolFilter}`,
    [sinceHours, ...symParams],
  );

  const fgMap = new Map<string, FgRow[]>();
  for (const r of fgRows) {
    const k = `${r.symbol}:${r.factor}`;
    const arr = fgMap.get(k) ?? [];
    arr.push(r);
    fgMap.set(k, arr);
  }

  for (const [, rows] of fgMap) {
    const latest = rows.find((r) => Number(r.rn) === 1);
    const prev = rows.find((r) => Number(r.rn) === 2);
    if (!latest || !prev || latest.grade === prev.grade) continue;
    changes.push({
      symbol: latest.symbol,
      name: latest.name,
      kind: "factor_grade",
      field: latest.factor,
      label: `因子 ${FACTOR_ZH[latest.factor] ?? latest.factor}`,
      from_value: prev.grade,
      to_value: latest.grade,
      captured_at: latest.captured_at,
    });
  }

  changes.sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1));
  return changes.slice(0, limit);
}

export function formatRatingChangeLine(c: RatingChange): string {
  return `**${c.symbol}** ${c.label}：${c.from_value ?? "—"} → **${c.to_value ?? "—"}**`;
}

export function ratingChangeMarkdownSection(changes: RatingChange[], title = "OPS 评级变动"): string {
  if (changes.length === 0) return "";
  const lines = [`## ${title}`, ""];
  for (const c of changes) {
    lines.push(`- ${formatRatingChangeLine(c)} · [详情](/t/${c.symbol})`);
  }
  lines.push("");
  return lines.join("\n");
}
