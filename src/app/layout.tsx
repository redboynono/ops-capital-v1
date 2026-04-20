import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ops Capital｜机构级宏观与科技投研平台",
  description: "机构级宏观与科技投研平台，Ops Capital 提供专业研报、订阅会员与编辑工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background font-[var(--font-body-sans)] text-foreground">
        <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
            <Link href="/" className="font-[var(--font-brand-serif)] text-xl tracking-[0.06em] text-accent-soft">
              Ops Capital
            </Link>
            <nav className="flex items-center gap-2 text-sm text-muted md:gap-3">
              <Link href="/reports" className="rounded-full px-3 py-1.5 hover:text-accent-soft">
                研报
              </Link>
              <Link href="/pricing" className="rounded-full px-3 py-1.5 hover:text-accent-soft">
                订阅
              </Link>
              <Link href="/dashboard" className="rounded-full px-3 py-1.5 hover:text-accent-soft">
                会员中心
              </Link>
              <Link href="/login" className="ghost-cta rounded-full px-3 py-1.5 text-foreground">
                登录
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
