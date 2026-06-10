import type { Metadata, Viewport } from "next";
import { SideNav } from "@/components/side-nav";
import { MobileTabBar } from "@/components/mobile-nav";
import {
  TerminalTopBar,
  TerminalTickerTape,
  TerminalFunctionBar,
} from "@/components/terminal-chrome";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "OPS Alpha · AI 驱动的中文投研桌面",
  description:
    "OPS Alpha 是 OPS Capital 旗下的 AI 投研与行情平台：深度研报、市场快讯、标的追踪与会员桌面。",
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0d",
};

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <div className="terminal min-h-screen">
      <TerminalTopBar userEmail={user?.email ?? null} />
      <TerminalTickerTape />
      <div className="flex min-h-[calc(100dvh-55px)] bg-[var(--background)]">
        <SideNav user={user} />
        <main className="terminal-main flex-1 min-w-0">{children}</main>
      </div>
      <MobileTabBar />
      <TerminalFunctionBar />
    </div>
  );
}
