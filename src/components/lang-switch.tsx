"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n/locale-types";

type Props = {
  locale: Locale;
  className?: string;
  compact?: boolean;
};

export function LangSwitch({ locale, className = "", compact }: Props) {
  const router = useRouter();
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
          className={`rounded-sm px-2 py-0.5 transition ${
            locale === l
              ? "bg-accent text-[#0a0a0d]"
              : "text-muted hover:text-foreground-soft"
          } ${compact ? "px-1.5" : ""}`}
        >
          {l === "zh" ? "中" : "EN"}
        </button>
      ))}
    </div>
  );
}
