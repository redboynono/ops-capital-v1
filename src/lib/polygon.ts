/**
 * Massive (Polygon.io) market data — Stocks + Options plans.
 * Requires POLYGON_API_KEY in env.
 */

const BASE = "https://api.polygon.io";

function apiKey(): string {
  const k = process.env.POLYGON_API_KEY;
  if (!k) throw new Error("POLYGON_API_KEY not set");
  return k;
}

type PolygonResponse<T> = {
  status?: string;
  message?: string;
  results?: T[];
  next_url?: string;
};

async function polygonGet<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apiKey", apiKey());

  const all: T[] = [];
  let next: string | null = url.toString();

  while (next && all.length < 2000) {
    const res = await fetch(next, { cache: "no-store" });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Polygon ${res.status}: ${t.slice(0, 200)}`);
    }
    const data = (await res.json()) as PolygonResponse<T>;
    if (data.status === "NOT_AUTHORIZED" || data.status === "ERROR") {
      throw new Error(data.message ?? `Polygon ${data.status ?? res.status}`);
    }
    if (data.results?.length) all.push(...data.results);
    if (!data.next_url) break;
    next = `${data.next_url}&apiKey=${apiKey()}`;
  }

  return all;
}

/** US equity tickers suitable for Polygon stocks snapshot (not indices/crypto/HK). */
export function isUsEquityTicker(symbol: string): boolean {
  const s = symbol.trim().toUpperCase();
  if (!s || s.startsWith("^")) return false;
  if (/^\d{4,5}$/.test(s) || s.endsWith(".HK")) return false;
  if (s.endsWith(".SS") || s.endsWith(".SZ")) return false;
  if (/-USD$/.test(s)) return false;
  if (s.includes("=")) return false; // forex USDCNY=X
  return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(s);
}

type StockSnapshotTicker = {
  ticker?: string;
  lastTrade?: { p?: number };
  day?: { c?: number; o?: number; h?: number; l?: number };
  prevDay?: { c?: number };
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number;
};

export async function getPolygonStockSnapshots(
  symbols: string[],
): Promise<Record<string, { c: number; d: number | null; dp: number | null; h: number; l: number; o: number; pc: number } | null>> {
  const us = symbols.filter(isUsEquityTicker);
  const out: Record<string, { c: number; d: number | null; dp: number | null; h: number; l: number; o: number; pc: number } | null> = {};
  for (const s of symbols) out[s] = null;
  if (us.length === 0) return out;

  const tickers = us.join(",");
  const url = `${BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${encodeURIComponent(tickers)}&apiKey=${apiKey()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return out;
  const data = (await res.json()) as { tickers?: StockSnapshotTicker[] };
  for (const row of data.tickers ?? []) {
    const sym = row.ticker?.toUpperCase();
    if (!sym) continue;
    const c = Number(row.lastTrade?.p ?? row.day?.c ?? 0);
    const pc = Number(row.prevDay?.c ?? row.day?.o ?? 0);
    if (!c) continue;
    const d = row.todaysChange ?? (pc ? c - pc : null);
    const dp = row.todaysChangePerc ?? (pc ? ((c - pc) / pc) * 100 : null);
    out[sym] = {
      c,
      d: d != null && Number.isFinite(d) ? d : null,
      dp: dp != null && Number.isFinite(dp) ? dp : null,
      h: Number(row.day?.h ?? c),
      l: Number(row.day?.l ?? c),
      o: Number(row.day?.o ?? c),
      pc: pc || c,
    };
  }
  return out;
}

export type PolygonOptionSnapshot = {
  underlying: string;
  contractTicker: string;
  contractType: "call" | "put";
  strike: number;
  expirationDate: string;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  underlyingPrice: number | null;
  dayChangePct: number | null;
  vwap: number | null;
  lastPrice: number | null;
};

type OptionSnapResult = {
  details?: {
    ticker?: string;
    contract_type?: string;
    strike_price?: number;
    expiration_date?: string;
    underlying_ticker?: string;
  };
  day?: {
    volume?: number;
    change_percent?: number;
    vwap?: number;
    close?: number;
  };
  open_interest?: number;
  implied_volatility?: number;
  underlying_asset?: { price?: number };
};

export async function fetchOptionsSnapshotForUnderlying(
  underlying: string,
  expirationDate: string,
  limit = 250,
): Promise<PolygonOptionSnapshot[]> {
  const sym = underlying.toUpperCase();
  const rows = await polygonGet<OptionSnapResult>(`/v3/snapshot/options/${sym}`, {
    expiration_date: expirationDate,
    limit: String(Math.min(limit, 250)),
  });

  return rows
    .sort((a, b) => Number(b.day?.volume ?? 0) - Number(a.day?.volume ?? 0))
    .map((r) => {
      const d = r.details;
      if (!d?.ticker || !d.strike_price || !d.expiration_date) return null;
      const ct = d.contract_type === "put" ? "put" : "call";
      return {
        underlying: sym,
        contractTicker: d.ticker,
        contractType: ct,
        strike: Number(d.strike_price),
        expirationDate: d.expiration_date,
        volume: Number(r.day?.volume ?? 0),
        openInterest: Number(r.open_interest ?? 0),
        impliedVolatility:
          r.implied_volatility != null && Number.isFinite(r.implied_volatility)
            ? Number(r.implied_volatility)
            : null,
        underlyingPrice:
          r.underlying_asset?.price != null ? Number(r.underlying_asset.price) : null,
        dayChangePct:
          r.day?.change_percent != null ? Number(r.day.change_percent) : null,
        vwap: r.day?.vwap != null && Number.isFinite(r.day.vwap) ? Number(r.day.vwap) : null,
        lastPrice:
          r.day?.close != null && Number.isFinite(r.day.close) ? Number(r.day.close) : null,
      } satisfies PolygonOptionSnapshot;
    })
    .filter((x): x is PolygonOptionSnapshot => x != null);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Earliest expiration on/after `onOrAfter` that has option quotes in snapshot. */
export async function findNearestActiveExpiration(
  underlying: string,
  onOrAfter = todayIsoDate(),
): Promise<string | null> {
  const sym = underlying.toUpperCase();
  const rows = await polygonGet<OptionSnapResult>(`/v3/snapshot/options/${sym}`, {
    limit: "250",
  });
  const dates = new Set<string>();
  for (const r of rows) {
    const exp = r.details?.expiration_date;
    if (!exp || exp < onOrAfter) continue;
    const vol = Number(r.day?.volume ?? 0);
    const oi = Number(r.open_interest ?? 0);
    if (vol > 0 || oi > 0) dates.add(exp);
  }
  if (dates.size === 0) return null;
  return [...dates].sort()[0] ?? null;
}
