"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState<"signin" | "signup" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const getFriendlyError = (err: unknown) => {
    if (err instanceof Error) {
      if (err.message.toLowerCase().includes("fetch")) {
        return "认证服务连接失败（Failed to fetch），请检查服务状态与服务器网络连通性";
      }
      return err.message;
    }

    return "请求失败，请稍后重试";
  };

  const onSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading("signin");

    if (!email.trim() || !password.trim()) {
      setLoading(null);
      setError("请输入邮箱和密码");
      return;
    }

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = (await response.json()) as { error?: string };

      setLoading(null);

      if (!response.ok) {
        setError(data.error ?? "登录失败");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setLoading(null);
      setError(getFriendlyError(err));
    }
  };

  const onSignUp = async () => {
    setError(null);
    setMessage(null);
    setLoading("signup");

    if (!email.trim() || !password.trim()) {
      setLoading(null);
      setError("请输入邮箱和密码");
      return;
    }

    if (password.length < 6) {
      setLoading(null);
      setError("密码至少 6 位");
      return;
    }

    if (password !== confirmPassword) {
      setLoading(null);
      setError("两次输入的密码不一致");
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
        }),
      });
      const data = (await response.json()) as { error?: string };

      setLoading(null);

      if (!response.ok) {
        setError(data.error ?? "注册失败");
        return;
      }

      setMessage("注册成功，已自动登录。");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setLoading(null);
      setError(getFriendlyError(err));
    }
  };

  const inputClass =
    "w-full rounded-xl border border-border/80 bg-surface/60 px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted/70 focus:border-accent focus:bg-surface-elevated";

  return (
    <div className="relative overflow-hidden pb-20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(176,139,87,0.14),transparent_40%)]" />

      <div className="relative mx-auto flex w-full max-w-md flex-col px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in">
          <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">会员入口</p>
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground">
            登录 Ops Capital
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            安全的邮箱 + 密码认证。几秒完成注册，即可进入投研桌。
          </p>
        </section>

        <form
          onSubmit={onSignIn}
          className="glass-panel rise-in mt-8 space-y-4 rounded-3xl p-6 md:p-7"
          style={{ animationDelay: "80ms" }}
        >
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">姓名（可选）</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="例如：Steven"
              className={inputClass}
            />
            <div className="text-right">
              <Link href="/forgot-password" className="text-xs text-muted hover:text-accent-soft">
                忘记密码？
              </Link>
            </div>
          </div>

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

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.22em] text-muted">密码</label>
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
            <label className="text-xs uppercase tracking-[0.22em] text-muted">确认密码（注册必填）</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              className={inputClass}
            />
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {message ? <p className="text-sm text-accent-soft">{message}</p> : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loading !== null}
              className="primary-cta rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide disabled:opacity-60"
            >
              {loading === "signin" ? "登录中..." : "登录"}
            </button>
            <button
              type="button"
              onClick={onSignUp}
              disabled={loading !== null}
              className="ghost-cta rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide disabled:opacity-60"
            >
              {loading === "signup" ? "注册中..." : "注册账号"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
