import type { Metadata, Viewport } from "next";
import { LocaleProvider } from "@/components/locale-provider";
import { SideNav } from "@/components/side-nav";
import { MobileTabBar } from "@/components/mobile-nav";
import {
  TerminalTopBar,
  TerminalTickerTape,
  TerminalFunctionBar,
} from "@/components/terminal-chrome";
import { getSessionUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AnalyticsProvider } from "@/components/analytics-provider";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return {
    title: t.meta.alphaTitle,
    description: t.meta.alphaDescription,
    applicationName: "OPS Alpha",
    appleWebApp: {
      capable: true,
      title: "OPS Alpha",
      statusBarStyle: "black-translucent",
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0d",
};

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, locale] = await Promise.all([getSessionUser(), getLocale()]);
  const dict = getDictionary(locale);

  return (
    <LocaleProvider locale={locale}>
      <div className="terminal min-h-screen">
        <TerminalTopBar userEmail={user?.email ?? null} locale={locale} />
        <TerminalTickerTape />
        <div className="flex min-h-[calc(100dvh-67px)] bg-[var(--background)]">
          <SideNav user={user} dict={dict} />
          <main className="terminal-main flex-1 min-w-0">{children}</main>
        </div>
        <MobileTabBar />
        <TerminalFunctionBar />
      </div>
      <AnalyticsProvider />
    </LocaleProvider>
  );
}
