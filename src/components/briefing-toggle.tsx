"use client";

import { useState } from "react";

export function BriefingToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const next = !enabled;
    try {
      const res = await fetch("/api/me/briefing-prefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setEnabled(next);
      setMsg(next ? "已开启每日邮件简报" : "已关闭每日邮件简报");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-[13px]">
      <div className="flex flex-col">
        <span className="text-foreground">每日邮件简报</span>
        <span className="text-[11px] text-muted">
          基于自选股，每日 8:30 (北京) 自动汇总发送到你的邮箱
        </span>
        {msg ? <span className="mt-1 text-[10px] text-accent-strong">{msg}</span> : null}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        role="switch"
        aria-checked={enabled}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
          enabled ? "bg-[color:var(--accent)]" : "bg-foreground-soft/30"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
