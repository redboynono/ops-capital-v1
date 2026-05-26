"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";

type NavItem = { href: string; label: string };

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "MARKET",
    items: [
      { href: "/alpha", label: "Alpha 首页" },
      { href: "/picks", label: "OPS 精选" },
      { href: "/conviction", label: "OPS 榜单" },
      { href: "/analysis", label: "深度研报" },
      { href: "/news", label: "市场快讯" },
      { href: "/earnings", label: "财报日历" },
      { href: "/rating-changes", label: "评级变动" },
      { href: "/expiring-options", label: OPTION_ALPHA.navLabel },
    ],
  },
  {
    title: "SCREEN",
    items: [
      { href: "/screener", label: "选股器" },
      { href: "/compare", label: "对比" },
      { href: "/tickers", label: "标的索引" },
      { href: "/dashboard/watchlist", label: "自选股" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { href: "/dashboard", label: "会员中心" },
      { href: "/dashboard/briefing", label: "每日简报" },
      { href: "/dashboard/portfolio", label: "模拟盘" },
      { href: "/dashboard/alerts", label: "实时提醒" },
      { href: "/dashboard/library", label: "收藏 / 历史" },
      { href: "/pricing", label: "订阅方案" },
      { href: "/help", label: "帮助" },
    ],
  },
];

const TABS: { href: string; label: string; match?: (p: string) => boolean }[] = [
  { href: "/alpha", label: "首页", match: (p) => p === "/alpha" },
  {
    href: "/analysis",
    label: "研报",
    match: (p) => p.startsWith("/analysis"),
  },
  { href: "/news", label: "快讯", match: (p) => p.startsWith("/news") },
  {
    href: "/expiring-options",
    label: "期权",
    match: (p) => p.startsWith("/expiring-options"),
  },
  {
    href: "/dashboard",
    label: "我的",
    match: (p) => p.startsWith("/dashboard") || p === "/pricing" || p.startsWith("/pay/"),
  },
];

function isActive(pathname: string, tab: (typeof TABS)[number]) {
  if (tab.match) return tab.match(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function MobileMenuButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-7 w-7 items-center justify-center rounded-sm border border-border md:hidden"
      aria-label="打开导航菜单"
    >
      <Menu className="h-4 w-4" style={{ color: "var(--foreground-soft)" }} />
    </button>
  );
}

export function MobileNavDrawer({
  open,
  onClose,
  userEmail,
}: {
  open: boolean;
  onClose: () => void;
  userEmail: string | null;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="导航菜单">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="关闭菜单"
        onClick={onClose}
      />
      <aside className="absolute left-0 top-0 flex h-full w-[min(300px,88vw)] flex-col border-r border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[14px] font-bold text-foreground">OPS ALPHA</p>
            <p className="text-[10px] text-muted">AI RESEARCH TERMINAL</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-border"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 text-[15px]">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="mb-4">
              <p className="label-caps mb-2 text-[11px]">{sec.title}</p>
              <div className="flex flex-col">
                {sec.items.map((it) => {
                  const active =
                    pathname === it.href || (it.href !== "/alpha" && pathname.startsWith(it.href));
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={onClose}
                      className={`rounded-sm px-2 py-2.5 leading-snug ${
                        active
                          ? "bg-accent-soft font-semibold text-accent-strong"
                          : "text-foreground-soft hover:bg-surface-muted"
                      }`}
                    >
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-4 py-3 text-[11px] text-muted">
          {userEmail ? (
            <p className="truncate font-mono">{userEmail}</p>
          ) : (
            <div className="flex gap-2">
              <Link href="/login" onClick={onClose} className="btn-primary px-3 py-1 text-[11px]">
                登录
              </Link>
              <Link
                href="/login?tab=signup"
                onClick={onClose}
                className="btn-outline px-3 py-1 text-[11px]"
              >
                注册
              </Link>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    for (const tab of TABS) {
      router.prefetch(tab.href);
    }
  }, [router]);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const navigate = useCallback(
    (href: string) => {
      const tab = TABS.find((t) => t.href === href);
      if (!tab || isActive(pathname, tab)) return;
      setPendingHref(href);
      startTransition(() => {
        router.push(href);
      });
    },
    [pathname, router],
  );

  return (
    <nav
      className="mobile-tab-bar pointer-events-auto fixed bottom-0 left-0 right-0 z-[90] grid grid-cols-5 border-t border-border bg-[var(--surface)] shadow-[0_-6px_16px_rgba(0,0,0,0.45)] touch-manipulation md:hidden"
      aria-label="主导航"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {TABS.map((tab) => {
        const active = isActive(pathname, tab);
        const loading = isPending && pendingHref === tab.href;
        return (
          <button
            key={tab.href}
            type="button"
            onClick={() => navigate(tab.href)}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[52px] w-full flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 py-2 text-[13px] font-semibold leading-none transition-colors active:bg-surface-muted ${
              active || loading
                ? "text-[color:var(--accent)]"
                : "text-foreground-soft"
            } ${loading ? "opacity-70" : ""}`}
          >
            <span
              className={`h-1 w-7 rounded-full ${active || loading ? "bg-[color:var(--accent)]" : "bg-transparent"}`}
            />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
