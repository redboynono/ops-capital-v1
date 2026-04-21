"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Static-ish demo tickers. In a later iteration these can be wired to a real feed.
const TAPE: { sym: string; px: string; chg: number }[] = [
  { sym: "NVDA",   px: "1234.56", chg: +2.41 },
  { sym: "TSLA",   px: "212.78",  chg: -1.25 },
  { sym: "AAPL",   px: "178.91",  chg: +0.42 },
  { sym: "MSFT",   px: "442.10",  chg: +0.88 },
  { sym: "GOOGL",  px: "166.72",  chg: -0.33 },
  { sym: "META",   px: "534.20",  chg: +1.74 },
  { sym: "AMZN",   px: "196.45",  chg: +0.51 },
  { sym: "AMD",    px: "161.02",  chg: -2.10 },
  { sym: "TSM",    px: "188.63",  chg: +1.22 },
  { sym: "AVGO",   px: "1702.90", chg: +3.15 },
  { sym: "BABA",   px: "87.41",   chg: -0.74 },
  { sym: "PDD",    px: "134.88",  chg: +1.02 },
  { sym: "NIO",    px: "5.21",    chg: -0.18 },
  { sym: "BTC",    px: "71234",   chg: +1.85 },
  { sym: "ETH",    px: "3812",    chg: +2.34 },
  { sym: "SOL",    px: "198.4",   chg: -0.92 },
  { sym: "HSI",    px: "19842",   chg: +0.62 },
  { sym: "00700",  px: "412.4",   chg: +0.88 },
  { sym: "09988",  px: "88.2",    chg: -0.44 },
  { sym: "SPX",    px: "5704.3",  chg: +0.41 },
  { sym: "NDX",    px: "20122.1", chg: +0.73 },
  { sym: "USD/CNY",px: "7.228",   chg: -0.04 },
  { sym: "USD/JPY",px: "154.1",   chg: +0.22 },
  { sym: "GOLD",   px: "2634.5",  chg: +0.31 },
  { sym: "WTI",    px: "68.9",    chg: -0.58 },
];

function formatChg(n: number) {
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
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
  // duplicate the array so the loop is seamless at 50% translateX
  const dup = [...TAPE, ...TAPE];
  return (
    <div className="ticker-tape" aria-label="market ticker">
      <div className="ticker-track px-3">
        {dup.map((t, i) => {
          const cls = t.chg > 0 ? "up" : t.chg < 0 ? "down" : "flat";
          const arrow = t.chg > 0 ? "▲" : t.chg < 0 ? "▼" : "·";
          return (
            <span key={`${t.sym}-${i}`} className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: "var(--foreground)" }}>{t.sym}</span>
              <span style={{ color: "var(--foreground-soft)" }}>{t.px}</span>
              <span className={cls}>
                {arrow} {formatChg(t.chg)}
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
