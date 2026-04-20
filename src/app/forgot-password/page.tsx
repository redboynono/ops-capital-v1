"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setResetUrl(null);

    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await response.json()) as { error?: string; message?: string; resetUrl?: string | null };

      if (!response.ok) {
        setError(data.error ?? "提交失败");
        return;
      }

      setMessage(data.message ?? "如果邮箱存在，我们已发送重置指引。");
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-border/80 bg-surface/60 px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:bg-surface-elevated";

  return (
    <div className="relative overflow-hidden pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(176,139,87,0.14),transparent_40%)]" />

      <div className="relative mx-auto flex w-full max-w-md flex-col px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in">
          <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">账号密码找回</p>
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground">忘记密码</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            请输入注册邮箱，我们将在几分钟内发送密码重置链接。
          </p>
        </section>

        <form
          onSubmit={onSubmit}
          className="glass-panel rise-in mt-8 space-y-4 rounded-3xl p-6 md:p-7"
          style={{ animationDelay: "80ms" }}
        >
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-accent-soft">{message}</p> : null}
          {resetUrl ? (
            <p className="break-all text-xs text-muted">
              测试环境重置链接：{" "}
              <a href={resetUrl} className="text-accent-soft hover:text-accent">
                {resetUrl}
              </a>
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="primary-cta rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide disabled:opacity-60"
          >
            {loading ? "提交中..." : "发送重置链接"}
          </button>
        </form>
      </div>
    </div>
  );
}
