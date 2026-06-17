"use client";

import { useState } from "react";
import { useDict } from "@/components/locale-provider";

export function ManageSubscriptionButton() {
  const s = useDict().subscriptionUi;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pay/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) {
        setError(data.message ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="btn-outline px-4 py-2 text-[13px] disabled:opacity-50"
      >
        {busy ? s.opening : s.manage}
      </button>
      <p className="mt-1 text-[11px] text-muted">{s.hint}</p>
      {error ? (
        <p className="mt-1 text-[11px] text-[color:var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}
