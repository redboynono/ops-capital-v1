import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ops Capital",
  description: "Institutional-grade macro and tech research platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
            <Link href="/" className="text-sm font-semibold tracking-wide text-emerald-300">
              Ops Capital
            </Link>
            <nav className="flex items-center gap-4 text-sm text-zinc-300">
              <Link href="/reports" className="hover:text-emerald-300">Reports</Link>
              <Link href="/pricing" className="hover:text-emerald-300">Pricing</Link>
              <Link href="/dashboard" className="hover:text-emerald-300">Dashboard</Link>
              <Link href="/login" className="hover:text-emerald-300">Login</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
