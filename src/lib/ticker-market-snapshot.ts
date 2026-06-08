import {
  fetchBasicFinancials,
  fetchCompanyProfile,
  getQuote as finnhubGetQuote,
} from "@/lib/finnhub";
import { getQuote as getUnifiedQuote } from "@/lib/quotes";
import { normalizeInternalSymbol } from "@/lib/symbol-resolve";
import {
  fetchYahooFundamentals,
  getQuote as getYahooQuote,
  isHkSymbol,
  toYahooSymbol,
} from "@/lib/yahoo";

export type TickerMarketSnapshot = {
  price: number | null;
  changePct: number | null;
  changeAbs: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  prevClose: number | null;
  marketCapM: number | null;
  sharesM: number | null;
  peTtm: number | null;
  psTtm: number | null;
  pb: number | null;
  high52: number | null;
  low52: number | null;
  beta: number | null;
  divYieldPct: number | null;
  currency: string;
  ipo: string | null;
};

function metricNum(m: Record<string, number | null | undefined>, key: string): number | null {
  const v = m[key];
  return v != null && Number.isFinite(Number(v)) ? Number(v) : null;
}

export async function fetchTickerMarketSnapshot(symbol: string): Promise<TickerMarketSnapshot> {
  const sym = normalizeInternalSymbol(symbol);
  const base: TickerMarketSnapshot = {
    price: null,
    changePct: null,
    changeAbs: null,
    dayHigh: null,
    dayLow: null,
    prevClose: null,
    marketCapM: null,
    sharesM: null,
    peTtm: null,
    psTtm: null,
    pb: null,
    high52: null,
    low52: null,
    beta: null,
    divYieldPct: null,
    currency: "USD",
    ipo: null,
  };

  const hk = isHkSymbol(sym);
  const ySym = hk ? toYahooSymbol(sym) : sym;

  const [profile, finnQ, fin, unifiedQ, yahooQ] = await Promise.all([
    hk ? Promise.resolve(null) : fetchCompanyProfile(sym).catch(() => null),
    hk ? Promise.resolve(null) : finnhubGetQuote(sym).catch(() => null),
    hk ? Promise.resolve(null) : fetchBasicFinancials(sym).catch(() => null),
    getUnifiedQuote(sym).catch(() => null),
    hk ? getYahooQuote(ySym).catch(() => null) : Promise.resolve(null),
  ]);

  const q =
    hk && yahooQ?.c
      ? yahooQ
      : finnQ?.c
        ? finnQ
        : unifiedQ?.c
          ? unifiedQ
          : yahooQ;
  if (q?.c) {
    base.price = q.c;
    base.changeAbs = q.d ?? null;
    base.changePct = q.dp ?? null;
    base.dayHigh = q.h ?? null;
    base.dayLow = q.l ?? null;
    base.prevClose = q.pc ?? null;
  }

  if (hk) {
    base.currency = yahooQ?.currency ?? "HKD";
  } else if (profile) {
    base.currency = profile.currency || "USD";
    base.ipo = profile.ipo || null;
    if (profile.marketCapitalization > 0) base.marketCapM = profile.marketCapitalization;
    if (profile.shareOutstanding > 0) base.sharesM = profile.shareOutstanding;
  }

  const m = (fin?.metric ?? {}) as Record<string, number | null | undefined>;
  base.peTtm = metricNum(m, "peTTM");
  base.psTtm = metricNum(m, "psTTM");
  base.pb = metricNum(m, "pbAnnual");
  base.high52 = metricNum(m, "52WeekHigh");
  base.low52 = metricNum(m, "52WeekLow");
  base.beta = metricNum(m, "beta");
  const div = metricNum(m, "dividendYieldIndicatedAnnual");
  base.divYieldPct = div;

  if (!base.marketCapM) {
    const capM = metricNum(m, "marketCapitalization");
    if (capM) base.marketCapM = capM;
  }

  if (!base.marketCapM || !base.peTtm || hk) {
    const y = await fetchYahooFundamentals(ySym).catch(() => null);
    if (y) {
      if (!base.marketCapM && y.marketCap) base.marketCapM = y.marketCap / 1e6;
      if (!base.peTtm && y.trailingPE) base.peTtm = y.trailingPE;
      if (!base.psTtm && y.priceToSales) base.psTtm = y.priceToSales;
      if (!base.pb && y.priceToBook) base.pb = y.priceToBook;
      if (!base.high52 && y.fiftyTwoWeekHigh) base.high52 = y.fiftyTwoWeekHigh;
      if (!base.low52 && y.fiftyTwoWeekLow) base.low52 = y.fiftyTwoWeekLow;
      if (!base.beta && y.beta) base.beta = y.beta;
    }
  }

  return base;
}
