"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/locale-types";

type Props = {
  locale: Locale;
  className?: string;
  compact?: boolean;
};

export function LangSwitch({ locale, className = "", compact }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  const setLocale = async (next: Locale) => {
    if (next === locale || busy) return;
    setBusy(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: next }),
      });
      // 去掉 URL 中的 ?lang，否则 proxy 会按落地参数重新注入 LOCALE_HEADER，
      // 永远压过用户刚设置的 cookie，导致无法手动切换语言。
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete("lang");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`inline-flex items-center rounded border border-border bg-surface p-0.5 text-[11px] font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      {(["zh", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={busy}
          onClick={() => void setLocale(l)}
          className={`rounded-sm px-2.5 py-1 transition ${
            locale === l
              ? "bg-accent text-[#0a0a0d]"
              : "text-muted hover:text-foreground-soft"
          } ${compact ? "px-2" : ""}`}
        >
          {l === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}
