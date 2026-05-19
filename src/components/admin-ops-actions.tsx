"use client";

import { useState } from "react";

export function AdminOpsActions() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, url: string, label: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "失败");
      setMsg(`${label}：${JSON.stringify(data)}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card mb-5 p-4">
      <p className="label-caps">数据维护</p>
      <p className="mt-1 text-[12px] text-muted">重算排名、写入评级历史快照（供 3M/6M 因子回溯）</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("ranks", "/api/admin/ops/recompute-ranks", "排名重算")}
          className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
        >
          {busy === "ranks" ? "…" : "重算 Quant 排名"}
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => run("snap", "/api/admin/ops/snapshot-ratings", "评级快照")}
          className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
        >
          {busy === "snap" ? "…" : "今日评级快照"}
        </button>
      </div>
      {msg ? <p className="mt-2 font-mono text-[11px] text-muted">{msg}</p> : null}
    </section>
  );
}
