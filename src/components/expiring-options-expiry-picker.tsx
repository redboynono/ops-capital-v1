"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { buildExpiringOptionsQuery, type ExpiryWeek } from "@/lib/options-expiry";

export function ExpiringOptionsExpiryPicker({
  week,
  thisFriday,
  nextFriday,
  symbol,
}: {
  week: ExpiryWeek;
  thisFriday: string;
  nextFriday: string;
  symbol?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const href = (w: ExpiryWeek) => {
    const q = buildExpiringOptionsQuery({ week: w, symbol: symbol || undefined });
    return `${pathname}${q}`;
  };

  const tabCls = (active: boolean) =>
    `rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${
      active
        ? "bg-accent text-white"
        : "border border-border bg-surface text-muted hover:text-foreground"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold text-muted">到期日</span>
      <Link href={href("this")} className={tabCls(week === "this")} prefetch={false}>
        本周五 <span className="font-mono text-[10px] opacity-90">{thisFriday}</span>
      </Link>
      <Link href={href("next")} className={tabCls(week === "next")} prefetch={false}>
        下周五 <span className="font-mono text-[10px] opacity-90">{nextFriday}</span>
      </Link>
      {searchParams.get("symbol") ? (
        <span className="text-[11px] text-muted-soft">
          标的 {searchParams.get("symbol")?.toUpperCase()}
        </span>
      ) : null}
    </div>
  );
}
