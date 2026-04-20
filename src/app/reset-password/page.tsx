"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!token) {
      setError("缺少重置令牌，请使用完整链接");
      return;
    }

    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "重置失败");
        return;
      }

      setMessage("密码重置成功，即将跳转登录页面。");
      setTimeout(() => {
        router.push("/login");
      }, 800);
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
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground">重置密码</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">设置新密码完成重置。</p>
        </section>

        <form
          onSubmit={onSubmit}
          className="glass-panel rise-in mt-8 space-y-4 rounded-3xl p-6 md:p-7"
          style={{ animationDelay: "80ms" }}
        >
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">新密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              className={inputClass}
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-accent-soft">{message}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="primary-cta rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide disabled:opacity-60"
          >
            {loading ? "重置中..." : "确认重置"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
