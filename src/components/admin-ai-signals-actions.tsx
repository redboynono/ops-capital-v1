"use client";

import { useState } from "react";

type Edition = {
  id: string;
  edition_date: string;
  status: string;
  published_at: string | null;
  email_sent_at: string | null;
};

export function AdminAiSignalsActions({ editions }: { editions: Edition[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const call = async (action: string, editionId?: string, force?: boolean) => {
    setBusy(action + (editionId ?? ""));
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ai-signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, editionId, force }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        count?: number;
        failures?: string[];
        emailHint?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setMsg(data?.error ?? "请求失败");
      } else if (action === "generate") {
        setMsg(`已生成 ${data.count ?? 0} 条${data.failures?.length ? ` · 失败: ${data.failures.join(", ")}` : ""}`);
        window.setTimeout(() => window.location.reload(), 1200);
      } else {
        setMsg(data.emailHint ?? "已发布");
        window.setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      setMsg("网络错误");
    } finally {
      setBusy(null);
    }
  };

  const draft = editions.find((e) => e.status === "draft");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => call("generate", draft?.id, true)}
          className="btn-primary px-3 py-1.5 text-[12px] disabled:opacity-50"
        >
          {busy?.startsWith("generate") ? "生成中…" : draft ? "重新生成本周 draft" : "生成本周 draft"}
        </button>
        {draft ? (
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => call("publish", draft.id)}
            className="btn-outline px-3 py-1.5 text-[12px] disabled:opacity-50"
          >
            {busy?.startsWith("publish") ? "发布中…" : "发布本周"}
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-[12px] text-muted">{msg}</p> : null}
      <p className="text-[11px] text-muted">
        周一 cron 自动生成 draft；admin 复核后点「发布」（将自动向 Research Pro 发邮件）。
      </p>
    </div>
  );
}
