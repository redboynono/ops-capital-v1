"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlobalSearch } from "@/components/global-search";
import { LangSwitch } from "@/components/lang-switch";
import { MobileMenuButton, MobileNavDrawer } from "@/components/mobile-nav";
import type { Locale } from "@/lib/i18n/locale-types";

// Ticker tape polls /api/quotes (Massive for US stocks/indices; Yahoo for HK/crypto/forex).
// `display` = tape label; `quote` = symbol passed to /api/quotes.
const TAPE_SYMBOLS: { display: string; quote: string }[] = [
  // Indices (US → Massive I:SPX / I:NDX / I:DJI)
  { display: "S&P",   quote: "^GSPC" },
  { display: "NDX",   quote: "^IXIC" },
  { display: "DJIA",  quote: "^DJI" },
  { display: "HSI",   quote: "^HSI" },
  { display: "SSE",   quote: "000001.SS" },
  // US mega-caps
  { display: "NVDA",  quote: "NVDA" },
  { display: "TSLA",  quote: "TSLA" },
  { display: "AAPL",  quote: "AAPL" },
  { display: "MSFT",  quote: "MSFT" },
  { display: "GOOGL", quote: "GOOGL" },
  { display: "META",  quote: "META" },
  { display: "AMZN",  quote: "AMZN" },
  { display: "AMD",   quote: "AMD" },
  { display: "AVGO",  quote: "AVGO" },
  // CN ADR
  { display: "BABA",  quote: "BABA" },
  { display: "PDD",   quote: "PDD" },
  { display: "NIO",   quote: "NIO" },
  // HK
  { display: "0700",  quote: "0700.HK" },
  { display: "9988",  quote: "9988.HK" },
  { display: "3690",  quote: "3690.HK" },
  // Crypto
  { display: "BTC",   quote: "BTC-USD" },
  { display: "ETH",   quote: "ETH-USD" },
  { display: "SOL",   quote: "SOL-USD" },
  // Forex
  { display: "USDCNY", quote: "CNY=X" },
  { display: "USDJPY", quote: "JPY=X" },
];

type TapeItem = { display: string; quote: string; price: number | null; chg: number | null };

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
        const symbols = TAPE_SYMBOLS.map((t) => t.quote).join(",");
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          quotes: Record<string, { c: number; dp: number | null } | null>;
        };
        if (cancelled) return;
        setItems(
          TAPE_SYMBOLS.map((t) => {
            const q = data.quotes?.[t.quote];
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

export function TerminalTopBar({
  userEmail,
  locale,
}: {
  userEmail?: string | null;
  locale: Locale;
}) {
  const timeStr = useNowHK();
  const mkt = useUSMarketStatus();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
    <div className="term-rail sticky top-0 z-40 flex h-10 items-center justify-between border-b px-3 text-[12px]">
      <div className="flex items-center gap-2 md:gap-3">
        <MobileMenuButton onOpen={() => setMenuOpen(true)} />
        <span className="mono font-bold" style={{ color: "var(--accent)" }}>OPS&nbsp;ALPHA</span>
        <span className="sep hidden sm:inline">|</span>
        <span className="mono hidden sm:inline">TERMINAL v1.0</span>
        <span className="sep hidden sm:inline">|</span>
        <span className="mono hidden items-center gap-1.5 sm:flex">
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

      <div className="flex items-center gap-2 md:gap-3">
        <LangSwitch locale={locale} compact className="hidden sm:inline-flex" />
        <GlobalSearch />
        {userEmail ? (
          <>
            <span className="mono hidden max-w-[120px] truncate md:inline md:max-w-[220px]">
              {userEmail.toUpperCase()}
            </span>
            <span className="sep hidden md:inline">|</span>
            <form action="/api/auth/signout" method="post" className="inline">
              <button type="submit" className="mono hover:text-[color:var(--accent)]">
                <span className="md:hidden">OUT</span>
                <span className="hidden md:inline">SIGN OUT</span>
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="mono hover:text-[color:var(--accent)]">LOGIN</Link>
            <span className="sep hidden sm:inline">|</span>
            <Link href="/login?tab=signup" className="mono hidden hover:text-[color:var(--accent)] sm:inline">
              SIGN UP
            </Link>
          </>
        )}
      </div>
    </div>
    <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} userEmail={userEmail ?? null} />
    </>
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
  const items: { label: string; href: string }[] = [
    { label: "HOME",  href: "/alpha" },
    { label: "ANLY",  href: "/analysis" },
    { label: "NEWS",  href: "/news" },
    { label: "SCRN",  href: "/tickers" },
    { label: "WATCH", href: "/dashboard/watchlist" },
    { label: "ACCT",  href: "/dashboard" },
    { label: "SUB",   href: "/pricing" },
    { label: "HELP",  href: "/help" },
  ];
  return (
    <div className="term-rail fixed bottom-0 left-0 right-0 z-30 hidden h-7 items-center gap-3 border-t px-3 text-[12px] md:flex">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className="mono hover:text-[color:var(--accent)]">
          {it.label}
        </Link>
      ))}
      <span className="sep mono hidden md:inline" style={{ marginLeft: "auto" }}>
        OPS CAPITAL © {new Date().getFullYear()}
      </span>
    </div>
  );
}
