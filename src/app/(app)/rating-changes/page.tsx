import Link from "next/link";
import { redirect } from "next/navigation";
import { listRecentRatingChanges } from "@/lib/rating-changes";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "评级变动 · OPS Alpha",
  description: "OPS Rating / Quant / Factor 近期变动流",
};

export default async function RatingChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ hours?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/rating-changes");

  const sp = await searchParams;
  const hours = Number(sp.hours ?? 72);
  const changes = await listRecentRatingChanges({
    sinceHours: Number.isFinite(hours) ? hours : 72,
    limit: 100,
  });

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Rating Changes</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">OPS 评级变动</h1>
        <p className="mt-1 text-[13px] text-muted">
          基于历史快照对比 · 近 {Number.isFinite(hours) ? hours : 72} 小时 · 共 {changes.length} 条
        </p>
        <div className="mt-2 flex gap-2 text-[12px]">
          <Link href="/rating-changes?hours=24" className="text-muted hover:text-accent-strong">
            24h
          </Link>
          <Link href="/rating-changes?hours=72" className="text-muted hover:text-accent-strong">
            72h
          </Link>
          <Link href="/rating-changes?hours=168" className="text-muted hover:text-accent-strong">
            7d
          </Link>
        </div>
      </header>

      {changes.length === 0 ? (
        <div className="card p-8 text-center text-[13px] text-muted">
          近期无显著评级变动。管理员可在{" "}
          <Link href="/admin/ops" className="text-accent-strong hover:underline">
            Ops 面板
          </Link>{" "}
          执行「今日评级快照」以积累历史。
        </div>
      ) : (
        <div className="card divide-y divide-border">
          {changes.map((c, i) => (
            <div key={`${c.symbol}-${c.field}-${i}`} className="flex items-center justify-between px-4 py-3 text-[13px]">
              <div>
                <Link href={`/t/${c.symbol}`} className="font-mono font-bold text-accent-strong hover:underline">
                  {c.symbol}
                </Link>
                <span className="ml-2 text-muted">{c.name}</span>
                <p className="mt-0.5 text-[12px] text-foreground-soft">
                  {c.label}：<span className="text-muted">{c.from_value}</span>
                  <span className="mx-1">→</span>
                  <span className="font-semibold text-accent-strong">{c.to_value}</span>
                </p>
              </div>
              <span className="font-mono text-[10px] text-muted">{c.captured_at.slice(0, 16)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
