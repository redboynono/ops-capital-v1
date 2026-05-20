import Link from "next/link";
import { redirect } from "next/navigation";
import { ExpiringOptionsPlaybook } from "@/components/expiring-options-playbook";
import { ExpiringOptionsRadar } from "@/components/expiring-options-radar";
import { ZERO_DTE_WATCHLIST } from "@/lib/expiring-options";
import { getSessionUser } from "@/lib/auth";

export const metadata = {
  title: "末日期权雷达 · OPS Alpha",
  description: "今日到期期权成交量与持仓异动",
};

export const dynamic = "force-dynamic";

export default async function ExpiringOptionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/expiring-options");

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Options · 0DTE</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">末日期权雷达</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          扫描高流动美股标的的<strong className="text-foreground-soft">当日到期</strong>
          期权，按成交量排序，辅助发现 0DTE 异动。行情约 15 分钟延迟，仅供研究参考。
        </p>
        <p className="mt-2 text-[11px] text-muted-soft">
          覆盖标的：{ZERO_DTE_WATCHLIST.join(" · ")}
        </p>
      </header>

      <div className="mb-5">
        <ExpiringOptionsPlaybook />
      </div>

      <ExpiringOptionsRadar limit={50} compact />

      <p className="mt-5 text-[12px] text-muted-soft">
        <Link href="/alpha" className="text-accent-strong hover:underline">
          ← 返回 Alpha 首页
        </Link>
      </p>
    </div>
  );
}
