"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserRound,
  Users,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+852", label: "🇭🇰 +852" },
  { code: "+886", label: "🇹🇼 +886" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+81", label: "🇯🇵 +81" },
];

const SMS_COUNTDOWN_SECONDS = 60;

/* ------------------------------------------------------------------ */
/*  Toast                                                              */
/* ------------------------------------------------------------------ */

function Toast({ text }: { text: string }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2">
      <div className="rounded bg-foreground px-4 py-2 text-[13px] font-medium text-background shadow-lg">
        {text}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Countdown hook                                                     */
/* ------------------------------------------------------------------ */

function useCountdown(seconds: number) {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const start = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  };

  return { remaining, start, active: remaining > 0 };
}

/* ------------------------------------------------------------------ */
/*  Reusable input shell                                               */
/* ------------------------------------------------------------------ */

function FieldShell({
  icon,
  children,
  trailing,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex h-11 items-center gap-2 rounded border border-border bg-surface px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
        {icon}
      </span>
      <div className="flex-1">{children}</div>
      {trailing}
    </div>
  );
}

const baseInputClass =
  "w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-soft outline-none";

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function LoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = sp.get("tab") === "signin" ? "signin" : "signup";
  const redirectTo = (() => {
    const r = sp.get("redirect");
    if (r && r.startsWith("/") && !r.startsWith("//")) return r;
    return "/alpha";
  })();

  const [tab, setTab] = useState<"signin" | "signup">(initialTab);

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+86");
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [smsLoading, setSmsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { remaining, start, active } = useCountdown(SMS_COUNTDOWN_SECONDS);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const isPhoneValid = (() => {
    const digits = phone.replace(/\D/g, "");
    if (countryCode === "+86") return /^1\d{10}$/.test(digits);
    return digits.length >= 6 && digits.length <= 15;
  })();

  const sendSmsCode = async () => {
    setError(null);
    if (!isPhoneValid) {
      setError("请输入有效的手机号");
      return;
    }
    setSmsLoading(true);
    try {
      const res = await fetch("/api/auth/send-sms-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          countryCode,
          purpose: tab,
        }),
      });
      const data = (await res.json()) as { error?: string; devCode?: string };
      if (!res.ok) {
        setError(data.error ?? "验证码发送失败");
        return;
      }
      start();
      flashToast(data.devCode ? `验证码已发送（dev: ${data.devCode}）` : "验证码已发送");
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setSmsLoading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPhoneValid) {
      setError("请输入有效的手机号");
      return;
    }
    if (!/^\d{4,8}$/.test(smsCode)) {
      setError("请输入收到的短信验证码");
      return;
    }
    if (tab === "signup") {
      if (!email.trim()) {
        setError("请输入邮箱（用于支付与回执）");
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
        setError("邮箱格式不正确");
        return;
      }
    }

    setLoading(true);
    try {
      const endpoint = tab === "signin" ? "/api/auth/sms-signin" : "/api/auth/sms-signup";
      const payload = {
        countryCode,
        phone: phone.replace(/\D/g, ""),
        smsCode: smsCode.trim(),
        ...(tab === "signup"
          ? {
              email: email.trim().toLowerCase(),
              username: username.trim() || null,
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
            }
          : {}),
      };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (tab === "signin" ? "登录失败" : "注册失败"));
        return;
      }
      flashToast(tab === "signin" ? "欢迎回来" : "注册成功，欢迎加入 OPS Alpha");
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

  /* ----------------------------- render ----------------------------- */

  return (
    <>
      {toast ? <Toast text={toast} /> : null}

      <div className="mx-auto w-full max-w-[440px] px-4 py-12">
        <header className="mb-6">
          <Link
            href="/"
            className="label-caps inline-flex items-center gap-1 hover:text-accent-strong"
          >
            ← OPS Capital
          </Link>
          <h1
            className="mt-3 text-[34px] font-bold leading-[1.15] tracking-tight text-foreground"
            style={{
              fontFamily:
                '"Source Han Serif SC", "Noto Serif SC", "Songti SC", "STSong", serif',
            }}
          >
            {tab === "signin" ? "登录 OPS Alpha" : "注册 OPS Alpha"}
          </h1>
          <p className="mt-2 text-[13px] text-muted">
            完善信息以快速登录 / 注册
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-4 inline-flex rounded border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              setError(null);
            }}
            className={`px-4 py-1.5 text-[12px] font-semibold transition ${
              tab === "signin"
                ? "rounded bg-accent text-background"
                : "text-muted hover:text-foreground"
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
            className={`px-4 py-1.5 text-[12px] font-semibold transition ${
              tab === "signup"
                ? "rounded bg-accent text-background"
                : "text-muted hover:text-foreground"
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          {/* 姓名三段式（仅注册） */}
          {tab === "signup" ? (
            <div>
              <label className="label-caps">姓名</label>
              <div className="mt-1 space-y-2">
                <FieldShell icon={<User className="h-4 w-4" strokeWidth={1.5} />}>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={baseInputClass}
                    placeholder="用户名（可选）"
                    autoComplete="username"
                  />
                </FieldShell>
                <FieldShell icon={<UserRound className="h-4 w-4" strokeWidth={1.5} />}>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={baseInputClass}
                    placeholder="名"
                    autoComplete="given-name"
                  />
                </FieldShell>
                <FieldShell icon={<Users className="h-4 w-4" strokeWidth={1.5} />}>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={baseInputClass}
                    placeholder="姓"
                    autoComplete="family-name"
                  />
                </FieldShell>
              </div>
            </div>
          ) : null}

          {/* 邮箱（仅注册） */}
          {tab === "signup" ? (
            <div>
              <label className="label-caps">邮箱</label>
              <div className="mt-1">
                <FieldShell icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={baseInputClass}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </FieldShell>
              </div>
            </div>
          ) : null}

          {/* 手机号 */}
          <div>
            <label className="label-caps">手机号</label>
            <div className="mt-1 flex h-11 items-center gap-2 rounded border border-border bg-surface px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
                <Phone className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="bg-transparent pr-1 text-[13px] text-foreground outline-none"
                aria-label="国家区号"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-surface text-foreground">
                    {c.label}
                  </option>
                ))}
              </select>
              <span className="h-4 w-px bg-border" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, ""))}
                className={baseInputClass}
                placeholder={countryCode === "+86" ? "13800138000" : "电话号码"}
                autoComplete="tel"
                required
              />
            </div>
          </div>

          {/* 短信验证码 */}
          <div>
            <label className="label-caps">短信验证码</label>
            <div className="mt-1">
              <FieldShell
                icon={<ShieldCheck className="h-4 w-4" strokeWidth={1.5} />}
                trailing={
                  <button
                    type="button"
                    disabled={active || smsLoading || !isPhoneValid}
                    onClick={sendSmsCode}
                    className="ml-2 rounded border border-accent/60 px-2.5 py-1 text-[12px] font-semibold text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:border-border disabled:text-muted-soft disabled:hover:bg-transparent"
                  >
                    {smsLoading ? (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        发送中
                      </span>
                    ) : active ? (
                      `${remaining}s 后重试`
                    ) : (
                      "获取验证码"
                    )}
                  </button>
                }
              >
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={8}
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                  className={baseInputClass}
                  placeholder="请输入收到的验证码"
                  autoComplete="one-time-code"
                />
              </FieldShell>
            </div>
          </div>

          {error ? (
            <p className="rounded border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 px-2 py-1.5 text-[12px] text-[color:var(--danger)]">
              {error}
            </p>
          ) : null}

          {/* 主按钮 */}
          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-accent text-[14px] font-bold text-background transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-70"
            style={{ letterSpacing: "0.04em" }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>处理中…</span>
              </>
            ) : (
              <span>登录 / 注册</span>
            )}
          </button>

          {/* 切换链接 */}
          <p className="pt-1 text-center text-[12px] text-muted">
            {tab === "signin" ? (
              <>
                还没有账号？
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className="ml-1 font-semibold text-accent hover:text-accent-strong"
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
                  className="ml-1 font-semibold text-accent hover:text-accent-strong"
                >
                  返回登录
                </button>
              </>
            )}
          </p>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted">
          注册即表示同意 OPS Capital 的
          <Link className="mx-1 hover:text-accent-strong" href="/terms">
            服务条款
          </Link>
          与
          <Link className="ml-1 hover:text-accent-strong" href="/privacy">
            隐私政策
          </Link>
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
