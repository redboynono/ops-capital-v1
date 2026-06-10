import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import type { Dictionary } from "@/lib/i18n";
import { buildNavSections } from "@/lib/i18n/nav";
import { OPTION_ALPHA } from "@/lib/option-alpha-brand";

export async function SideNav({
  user,
  dict,
}: {
  user: SessionUser | null;
  dict: Dictionary;
}) {
  const isAdmin = isAdminEmail(user?.email);
  const n = dict.nav;
  const sections = buildNavSections(dict, OPTION_ALPHA.navLabel);

  return (
    <aside className="sticky top-[55px] hidden h-[calc(100dvh-55px-24px)] w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface px-3 py-4 md:flex">
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

      <nav className="mt-5 flex flex-col gap-4 text-[14px]">
        {sections.map((sec) => (
          <div key={sec.title}>
            <p className="label-caps mb-1.5" style={{ fontSize: 11, letterSpacing: "0.18em" }}>
              {sec.title}
            </p>
            <div className="flex flex-col">
              {sec.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className="px-2 py-1.5 leading-snug text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]"
                >
                  {it.label}
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
                {n.adminHome}
              </Link>
              <Link href="/admin/posts" className="px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]">
                {n.adminPosts}
              </Link>
              <Link href="/admin/editor" className="px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]">
                {n.adminEditor}
              </Link>
              <Link href="/admin/ratings" className="px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]">
                {n.adminRatings}
              </Link>
              <Link href="/admin/picks" className="px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]">
                {n.adminPicks}
              </Link>
              <Link href="/admin/social" className="px-2 py-1 text-foreground-soft hover:bg-surface-muted hover:text-[color:var(--accent)]">
                {n.adminSocial}
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
