import type { Dictionary } from "./zh";

export type NavItem = { href: string; label: string };
export type NavSection = { title: string; items: NavItem[] };

export function buildNavSections(dict: Dictionary, optionsNavLabel: string): NavSection[] {
  const n = dict.nav;
  return [
    {
      title: "MARKET",
      items: [
        { href: "/alpha", label: n.alphaHome },
        { href: "/picks", label: n.picks },
        { href: "/conviction", label: n.conviction },
        { href: "/analysis", label: n.analysis },
        { href: "/news", label: n.news },
        { href: "/earnings", label: n.earnings },
        { href: "/rating-changes", label: n.ratingChanges },
        { href: "/track-record", label: n.trackRecord },
        { href: "/crypto", label: n.crypto },
        { href: "/expiring-options", label: optionsNavLabel },
      ],
    },
    {
      title: "SCREEN",
      items: [
        { href: "/screener", label: n.screener },
        { href: "/compare", label: n.compare },
        { href: "/tickers", label: n.tickers },
        { href: "/dashboard/watchlist", label: n.watchlist },
      ],
    },
    {
      title: "ACCOUNT",
      items: [
        { href: "/dashboard", label: n.dashboard },
        { href: "/dashboard/briefing", label: n.briefing },
        { href: "/dashboard/portfolio", label: n.portfolio },
        { href: "/dashboard/alerts", label: n.alerts },
        { href: "/dashboard/library", label: n.library },
        { href: "/dashboard/profile", label: n.profile },
        { href: "/pricing", label: n.pricing },
      ],
    },
  ];
}

export function buildMobileTabs(dict: Dictionary) {
  const n = dict.nav;
  return [
    { href: "/alpha", label: n.tabHome, match: (p: string) => p === "/alpha" },
    { href: "/analysis", label: n.tabAnalysis, match: (p: string) => p.startsWith("/analysis") },
    { href: "/news", label: n.tabNews, match: (p: string) => p.startsWith("/news") },
    {
      href: "/expiring-options",
      label: n.tabOptions,
      match: (p: string) => p.startsWith("/expiring-options"),
    },
    {
      href: "/dashboard",
      label: n.tabAccount,
      match: (p: string) =>
        p.startsWith("/dashboard") || p === "/pricing" || p.startsWith("/pay/"),
    },
  ];
}
