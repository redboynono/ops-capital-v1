import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OPS Capital · 穿越周期的中国投资机构",
  description:
    "OPS Capital 以系统化研究、原则驱动的决策与 AI 杠杆，帮助长期投资者理解宏观、识别阿尔法、穿越周期。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
