"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Symbols to poll via Yahoo Finance (/api/quotes). No key needed; works for
// US stocks, HK, A-shares, indices, crypto.
// `display` is what the tape shows; `yahoo` is the Yahoo symbol format.
const TAPE_SYMBOLS: { display: string; yahoo: string }[] = [
  // Indices
  { display: "S&P",   yahoo: "^GSPC" },
  { display: "NDX",   yahoo: "^IXIC" },
  { display: "DJIA",  yahoo: "^DJI" },
  { display: "HSI",   yahoo: "^HSI" },
  { display: "SSE",   yahoo: "000001.SS" },
  // US mega-caps
  { display: "NVDA",  yahoo: "NVDA" },
  { display: "TSLA",  yahoo: "TSLA" },
  { display: "AAPL",  yahoo: "AAPL" },
  { display: "MSFT",  yahoo: "MSFT" },
  { display: "GOOGL", yahoo: "GOOGL" },
  { display: "META",  yahoo: "META" },
  { display: "AMZN",  yahoo: "AMZN" },
  { display: "AMD",   yahoo: "AMD" },
  { display: "AVGO",  yahoo: "AVGO" },
  // CN ADR
  { display: "BABA",  yahoo: "BABA" },
  { display: "PDD",   yahoo: "PDD" },
  { display: "NIO",   yahoo: "NIO" },
  // HK
  { display: "0700",  yahoo: "0700.HK" },
  { display: "9988",  yahoo: "9988.HK" },
  { display: "3690",  yahoo: "3690.HK" },
  // Crypto
  { display: "BTC",   yahoo: "BTC-USD" },
  { display: "ETH",   yahoo: "ETH-USD" },
  { display: "SOL",   yahoo: "SOL-USD" },
  // Forex
  { display: "USDCNY", yahoo: "CNY=X" },
  { display: "USDJPY", yahoo: "JPY=X" },
];

type TapeItem = { display: string; yahoo: string; price: number | null; chg: number | null };

function formatChg(n: number) {
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function formatPrice(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toFixed(2);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

function useLiveTape(): TapeItem[] {
  const [items, setItems] = useState<TapeItem[]>(
    TAPE_SYMBOLS.map((t) => ({ ...t, price: null, chg: null })),
  );
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const symbols = TAPE_SYMBOLS.map((t) => t.yahoo).join(",");
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          quotes: Record<string, { c: number; dp: number | null } | null>;
        };
        if (cancelled) return;
        setItems(
          TAPE_SYMBOLS.map((t) => {
            const q = data.quotes?.[t.yahoo];
            return {
              ...t,
              price: q?.c ?? null,
              chg: q?.dp ?? null,
            };
          }),
        );
      } catch {
        /* ignore */
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  return items;
}

function useNowHK() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!now) return "--:--:--";
  // Hong Kong time, 24h
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(now).toUpperCase();
  return `${date} ${parts} HKT`;
}

function useUSMarketStatus() {
  // Returns a label + dot color class based on US ET session.
  const [label, setLabel] = useState("US MKT --");
  const [tone, setTone] = useState<"up" | "down" | "flat">("flat");
  useEffect(() => {
    const calc = () => {
      const now = new Date();
      // Get ET parts
      const etParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(now);
      const get = (t: string) => etParts.find((p) => p.type === t)?.value ?? "";
      const wk = get("weekday");
      const h = parseInt(get("hour"), 10);
      const m = parseInt(get("minute"), 10);
      const mins = h * 60 + m;
      const isWeekday = !["Sat", "Sun"].includes(wk);
      // Regular: 09:30 – 16:00 ET
      const open = 9 * 60 + 30;
      const close = 16 * 60;
      // Pre: 04:00 – 09:30 · After: 16:00 – 20:00
      const preOpen = 4 * 60;
      const afterClose = 20 * 60;
      if (isWeekday && mins >= open && mins < close) {
        setLabel("US MKT OPEN");
        setTone("up");
      } else if (isWeekday && mins >= preOpen && mins < open) {
        setLabel("US PRE-MKT");
        setTone("flat");
      } else if (isWeekday && mins >= close && mins < afterClose) {
        setLabel("US AFTER-HRS");
        setTone("flat");
      } else {
        setLabel("US MKT CLOSED");
        setTone("down");
      }
    };
    calc();
    const t = window.setInterval(calc, 30_000);
    return () => window.clearInterval(t);
  }, []);
  return { label, tone };
}

export function TerminalTopBar({ userEmail }: { userEmail?: string | null }) {
  const timeStr = useNowHK();
  const mkt = useUSMarketStatus();

  return (
    <div className="term-rail sticky top-0 z-40 flex h-7 items-center justify-between border-b px-3 text-[11px]">
      <div className="flex items-center gap-3">
        <span className="mono font-bold" style={{ color: "var(--accent)" }}>OPS&nbsp;ALPHA</span>
        <span className="sep">|</span>
        <span className="mono">TERMINAL v1.0</span>
        <span className="sep">|</span>
        <span className="mono flex items-center gap-1.5">
          <span className="live-dot" />
          LIVE
        </span>
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <span className={`mono ${mkt.tone === "up" ? "up" : mkt.tone === "down" ? "down" : "flat"}`}>
          ● {mkt.label}
        </span>
        <span className="sep">|</span>
        <span className="mono">{timeStr}</span>
      </div>

      <div className="flex items-center gap-3">
        {userEmail ? (
          <>
            <span className="mono truncate max-w-[220px]">{userEmail.toUpperCase()}</span>
            <span className="sep">|</span>
            <form action="/api/auth/signout" method="post" className="inline">
              <button type="submit" className="mono hover:text-[color:var(--accent)]">SIGN OUT</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="mono hover:text-[color:var(--accent)]">LOGIN</Link>
            <span className="sep">|</span>
            <Link href="/login?tab=signup" className="mono hover:text-[color:var(--accent)]">SIGN UP</Link>
          </>
        )}
      </div>
    </div>
  );
}

export function TerminalTickerTape() {
  const items = useLiveTape();
  // duplicate the array so the CSS loop is seamless at 50% translateX
  const dup = [...items, ...items];
  return (
    <div className="ticker-tape" aria-label="market ticker">
      <div className="ticker-track px-3">
        {dup.map((t, i) => {
          const chg = t.chg;
          const cls = chg == null ? "flat" : chg > 0 ? "up" : chg < 0 ? "down" : "flat";
          const arrow = chg == null ? "·" : chg > 0 ? "▲" : chg < 0 ? "▼" : "·";
          const priceText = t.price == null ? "—" : formatPrice(t.price);
          const chgText = chg == null ? "--" : formatChg(chg);
          return (
            <span key={`${t.display}-${i}`} className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>{t.display}</span>
              <span style={{ color: "var(--foreground-soft)" }}>{priceText}</span>
              <span className={cls}>
                {arrow} {chgText}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function TerminalFunctionBar() {
  const keys: { k: string; label: string; href: string }[] = [
    { k: "F1", label: "HOME",  href: "/alpha" },
    { k: "F2", label: "ANLY",  href: "/analysis" },
    { k: "F3", label: "NEWS",  href: "/news" },
    { k: "F4", label: "SCRN",  href: "/tickers" },
    { k: "F5", label: "WATCH", href: "/dashboard/watchlist" },
    { k: "F6", label: "ACCT",  href: "/dashboard" },
    { k: "F7", label: "SUB",   href: "/pricing" },
    { k: "F8", label: "HELP",  href: "/help" },
  ];
  return (
    <div className="term-rail fixed bottom-0 left-0 right-0 z-40 flex h-6 items-center gap-3 border-t px-3 text-[10px]">
      {keys.map((k) => (
        <Link key={k.k} href={k.href} className="mono flex items-center gap-1 hover:text-[color:var(--accent)]">
          <span style={{ color: "var(--accent)" }}>{k.k}</span>
          <span>{k.label}</span>
        </Link>
      ))}
      <span className="sep mono hidden md:inline" style={{ marginLeft: "auto" }}>
        OPS CAPITAL © {new Date().getFullYear()}
      </span>
    </div>
  );
}
