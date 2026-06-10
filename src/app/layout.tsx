import type { Metadata } from "next";
import { getDictionary, getLocale, htmlLang } from "@/lib/i18n";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return {
    title: t.meta.siteTitle,
    description: t.meta.siteDescription,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html lang={htmlLang(locale)} className="antialiased">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
