import type { Metadata } from "next";
import { SideNav } from "@/components/side-nav";
import {
  TerminalTopBar,
  TerminalTickerTape,
  TerminalFunctionBar,
} from "@/components/terminal-chrome";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "OPS Alpha · AI 驱动的中文投研桌面",
  description:
    "OPS Alpha 是 OPS Capital 旗下的 AI 投研与行情平台：分析长文、市场快讯、标的追踪与会员桌面。",
};

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  return (
    <div className="terminal min-h-screen">
      <TerminalTopBar userEmail={user?.email ?? null} />
      <TerminalTickerTape />
      <div className="flex min-h-[calc(100vh-64px)]">
        <SideNav />
        <div className="flex-1 min-w-0 pb-8">{children}</div>
      </div>
      <TerminalFunctionBar />
    </div>
  );
}
