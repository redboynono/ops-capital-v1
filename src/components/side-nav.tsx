import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

type NavItem = { href: string; label: string; fkey?: string };

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "MARKET",
    items: [
      { href: "/alpha",    label: "Alpha 首页",   fkey: "F1" },
      { href: "/analysis", label: "分析长文",     fkey: "F2" },
      { href: "/news",     label: "市场快讯",     fkey: "F3" },
    ],
  },
  {
    title: "SCREEN",
    items: [
      { href: "/tickers",              label: "标的索引", fkey: "F4" },
      { href: "/dashboard/watchlist",  label: "自选股",   fkey: "F5" },
    ],
  },
  {
    title: "ACCOUNT",
    items: [
      { href: "/dashboard",         label: "会员中心",  fkey: "F6" },
      { href: "/dashboard/library", label: "收藏 / 历史" },
      { href: "/dashboard/profile", label: "资料" },
      { href: "/pricing",           label: "订阅方案",  fkey: "F7" },
    ],
  },
];

export async function SideNav() {
  const user = await getSessionUser();
  const isAdmin = isAdminEmail(user?.email);

  return (
    <aside className="sticky top-[calc(28px+27px)] hidden h-[calc(100vh-61px-24px)] w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 md:flex">
      <div>
        <Link href="/alpha" className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-foreground">
          <span
            className="inline-flex h-6 w-6 items-center justify-center text-[13px] font-black"
            style={{ background: "var(--accent)", color: "#0a0a0d" }}
          >
            α
          </span>
          <span>OPS ALPHA</span>
        </Link>
        <p className="mt-1 text-[10px] leading-tight mono" style={{ color: "var(--muted)" }}>
          AI RESEARCH TERMINAL
        </p>
        <Link
          href="/"
          className="mt-2 inline-block text-[10px] mono"
          style={{ color: "var(--muted)" }}
        >
          ← OPS.CAPITAL
        </Link>
      </div>

      <nav className="mt-5 flex flex-col gap-4 text-[12px]">
        {sections.map((sec) => (
          <div key={sec.title}>
            <p className="label-caps mb-1.5" style={{ fontSize: 10, letterSpacing: "0.18em" }}>
              {sec.title}
            </p>
            <div className="flex flex-col">
              {sec.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="group flex items-center justify-between px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]"
                >
                  <span>{it.label}</span>
                  {it.fkey ? (
                    <span
                      className="mono text-[9px] opacity-60 group-hover:opacity-100"
                      style={{ color: "var(--accent)" }}
                    >
                      {it.fkey}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ))}

        {isAdmin ? (
          <div>
            <p className="label-caps mb-1.5" style={{ fontSize: 10, letterSpacing: "0.18em", color: "var(--accent)" }}>
              ADMIN
            </p>
            <div className="flex flex-col">
              <Link href="/admin" className="px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]">
                后台首页
              </Link>
              <Link href="/admin/editor" className="px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]">
                AI 编辑器
              </Link>
            </div>
          </div>
        ) : null}
      </nav>

      <div className="mt-auto border-t border-border pt-3 text-[11px]">
        {user ? (
          <div className="space-y-1">
            <p className="mono truncate" style={{ color: "var(--muted)" }}>{user.email}</p>
            <div className="flex items-center gap-2 mono text-[10px]">
              <Link href="/dashboard/profile" style={{ color: "var(--foreground-soft)" }}>
                PROFILE
              </Link>
              <span style={{ color: "var(--muted-soft)" }}>/</span>
              <form action="/api/auth/signout" method="post" className="inline">
                <button type="submit" style={{ color: "var(--foreground-soft)" }}>
                  LOGOUT
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-primary px-3 py-1 text-[11px] mono">
              LOGIN
            </Link>
            <Link href="/login?tab=signup" className="btn-outline px-3 py-1 text-[11px] mono">
              SIGN UP
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
