"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

function Toast({ text }: { text: string }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2">
      <div className="rounded bg-foreground px-4 py-2 text-[13px] font-medium text-white shadow-lg">
        {text}
      </div>
    </div>
  );
}

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = sp.get("tab") === "signup" ? "signup" : "signin";
  const redirectTo = (() => {
    const r = sp.get("redirect");
    // only allow same-site paths
    if (r && r.startsWith("/") && !r.startsWith("//")) return r;
    return "/alpha";
  })();
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // focus email on mount / tab change
    emailInputRef.current?.focus();
  }, [tab]);

  const input =
    "w-full rounded border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-soft focus:border-accent focus:ring-2 focus:ring-accent/20 transition";

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("请输入邮箱和密码");
      return;
    }
    setLoading(true);

    try {
      if (tab === "signin") {
        const res = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "登录失败");
          return;
        }
        flashToast("欢迎回来");
      } else {
        if (password.length < 6) {
          setError("密码至少 6 位");
          return;
        }
        if (password !== confirmPassword) {
          setError("两次输入的密码不一致");
          return;
        }
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim() }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setError(data.error ?? "注册失败");
          return;
        }
        flashToast("注册成功，欢迎加入 OPS Alpha");
      }
      window.setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const submitForgot = async (e: FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      setForgotMsg(data.message ?? data.error ?? "已处理");
    } catch (err) {
      setForgotMsg(err instanceof Error ? err.message : "请求失败");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      {toast ? <Toast text={toast} /> : null}

      <div className="mx-auto w-full max-w-[420px] px-4 py-10">
        <header className="mb-4">
          <Link href="/" className="label-caps hover:text-accent-strong">
            ← OPS Capital
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">
            {tab === "signin" ? "登录 OPS Alpha" : "注册 OPS Alpha"}
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {tab === "signin" ? "欢迎回来，继续你的投研工作台" : "开始使用 AI 驱动的中文投研桌面"}
          </p>
        </header>

        <div className="mb-3 inline-flex rounded border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              setError(null);
            }}
            className={`px-3 py-1 text-[12px] font-semibold transition ${
              tab === "signin" ? "rounded bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("signup");
              setError(null);
            }}
            className={`px-3 py-1 text-[12px] font-semibold transition ${
              tab === "signup" ? "rounded bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="card space-y-3 p-4">
          {tab === "signup" ? (
            <div>
              <label className="label-caps">姓名（可选）</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={input}
                placeholder="例：孙"
              />
            </div>
          ) : null}

          <div>
            <label className="label-caps">邮箱</label>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={input}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="label-caps">密码</label>
              {tab === "signin" ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowForgot((v) => !v);
                    setForgotMsg(null);
                    setForgotEmail(email);
                  }}
                  className="text-[11px] text-muted hover:text-accent-strong"
                >
                  忘记密码?
                </button>
              ) : null}
            </div>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                autoComplete={tab === "signin" ? "current-password" : "new-password"}
                className={`${input} pr-14`}
                placeholder={tab === "signup" ? "至少 6 位" : ""}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted hover:text-accent-strong"
              >
                {showPwd ? "隐藏" : "显示"}
              </button>
            </div>
          </div>

          {tab === "signup" ? (
            <div>
              <label className="label-caps">确认密码</label>
              <input
                type={showPwd ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
                autoComplete="new-password"
                className={input}
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 px-2 py-1.5 text-[12px] text-[color:var(--danger)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex w-full items-center justify-center gap-2 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Spinner />
                <span>{tab === "signin" ? "正在登录..." : "正在注册..."}</span>
              </>
            ) : (
              <span>{tab === "signin" ? "登录" : "创建账号"}</span>
            )}
          </button>

          <p className="pt-1 text-center text-[11px] text-muted">
            {tab === "signin" ? (
              <>
                还没有账号？
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className="ml-1 font-semibold text-accent-strong hover:underline"
                >
                  立即注册
                </button>
              </>
            ) : (
              <>
                已有账号？
                <button
                  type="button"
                  onClick={() => setTab("signin")}
                  className="ml-1 font-semibold text-accent-strong hover:underline"
                >
                  返回登录
                </button>
              </>
            )}
          </p>
        </form>

        {showForgot ? (
          <form onSubmit={submitForgot} className="card mt-3 space-y-2 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-foreground">找回密码</h2>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="text-[11px] text-muted hover:text-foreground"
              >
                关闭
              </button>
            </div>
            <p className="text-[12px] text-muted">输入邮箱，我们会发送重置链接。</p>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              required
              className={input}
              placeholder="you@example.com"
            />
            <button
              type="submit"
              disabled={forgotLoading}
              className="btn-primary flex w-full items-center justify-center gap-2 py-2 text-[13px] disabled:opacity-70"
            >
              {forgotLoading ? (
                <>
                  <Spinner />
                  <span>发送中...</span>
                </>
              ) : (
                <span>发送重置邮件</span>
              )}
            </button>
            {forgotMsg ? <p className="text-[12px] text-muted">{forgotMsg}</p> : null}
          </form>
        ) : null}

        <p className="mt-6 text-center text-[11px] text-muted">
          注册即表示同意 OPS Capital 的
          <a className="mx-1 hover:text-accent-strong" href="#">服务条款</a>与
          <a className="ml-1 hover:text-accent-strong" href="#">隐私政策</a>
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
