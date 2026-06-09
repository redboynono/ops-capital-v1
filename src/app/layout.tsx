import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OPS Capital · AI 与半导体价值链投资",
  description:
    "OPS Capital 深耕 AI 算力革命与半导体产业链，以自研六层价值链模型（L0–L5）系统追踪晶圆制造、芯片设计、算力基建、云分发、大模型与 Agent 应用。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="antialiased">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
