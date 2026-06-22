"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useDict } from "@/components/locale-provider";
import { fmt } from "@/lib/i18n/fmt";
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
  const o = useDict().optionsPage;

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
      <span className="text-[11px] font-semibold text-muted">{o.expiryPicker.label}</span>
      <Link href={href("this")} className={tabCls(week === "this")} prefetch={false}>
        {o.expiry.thisFriday}{" "}
        <span className="font-mono text-[10px] opacity-90">{thisFriday}</span>
      </Link>
      <Link href={href("next")} className={tabCls(week === "next")} prefetch={false}>
        {o.expiry.nextFriday}{" "}
        <span className="font-mono text-[10px] opacity-90">{nextFriday}</span>
      </Link>
      {searchParams.get("symbol") ? (
        <span className="text-[11px] text-muted-soft">
          {fmt(o.expiryPicker.symbolFmt, {
            symbol: searchParams.get("symbol")!.toUpperCase(),
          })}
        </span>
      ) : null}
    </div>
  );
}
