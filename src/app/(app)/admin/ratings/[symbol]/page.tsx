import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RatingEditor } from "@/components/rating-editor";
import { requireAdmin } from "@/lib/admin";
import { getTickerBySymbol } from "@/lib/tickers";

export const dynamic = "force-dynamic";

export default async function AdminRatingEditorPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const { symbol: raw } = await params;
  const symbol = raw.toUpperCase();
  const ticker = await getTickerBySymbol(symbol);
  if (!ticker) notFound();

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">后台</Link>
        <span className="mx-1">/</span>
        <Link href="/admin/ratings" className="hover:text-accent-strong">评级管理</Link>
        <span className="mx-1">/</span>
        <span>{symbol}</span>
      </nav>

      <header className="mt-3 mb-4 border-b border-border pb-3">
        <span className="label-caps">OPS Rating Editor</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          <span className="font-mono">{symbol}</span>
          <span className="ml-3 text-[15px] font-semibold text-foreground-soft">{ticker.name}</span>
        </h1>
        <p className="mt-1 text-[13px] text-muted">
          行业：{ticker.sector ?? "未设置"} · 交易所：{ticker.exchange}
        </p>
      </header>

      <RatingEditor symbol={symbol} defaultIndustry={ticker.sector ?? ""} />
    </div>
  );
}
