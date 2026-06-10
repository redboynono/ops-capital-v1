"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  Loader2,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  UserRound,
  Users,
} from "lucide-react";

const COUNTRY_CODES: { code: string; label: string }[] = [
  { code: "+86", label: "🇨🇳 +86" },
  { code: "+852", label: "🇭🇰 +852" },
  { code: "+886", label: "🇹🇼 +886" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+65", label: "🇸🇬 +65" },
  { code: "+81", label: "🇯🇵 +81" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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
/*  Captcha hook                                                       */
/* ------------------------------------------------------------------ */

function useCaptcha() {
  const [svg, setSvg] = useState<string>("");
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/captcha", { cache: "no-store" });
      const data = (await res.json()) as { svg: string; token: string };
      setSvg(data.svg);
      setToken(data.token);
    } catch {
      // ignore; user can click refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { svg, token, loading, refresh };
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
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

  // 注册字段
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+86");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 登录字段
  const [identifier, setIdentifier] = useState(""); // 邮箱或用户名

  // 共享
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [captchaInput, setCaptchaInput] = useState("");

  const captcha = useCaptcha();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flashToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const resetForm = () => {
    setError(null);
    setCaptchaInput("");
    captcha.refresh();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!captchaInput.trim()) {
      setError("请输入图形验证码");
      return;
    }

    if (tab === "signin") {
      if (!identifier.trim() || !password) {
        setError("请填写账号和密码");
        return;
      }
    } else {
      if (!email.trim()) return setError("请输入邮箱");
      if (!password || password.length < 6) return setError("密码至少 6 位");
      if (password !== confirmPassword) return setError("两次密码不一致");
      const digits = phone.replace(/\D/g, "");
      if (!digits) return setError("请输入手机号");
      if (countryCode === "+86" && !/^1\d{10}$/.test(digits)) {
        return setError("请输入有效的中国大陆手机号");
      }
    }

    setLoading(true);
    try {
      const endpoint = tab === "signin" ? "/api/auth/signin" : "/api/auth/signup";
      const payload =
        tab === "signin"
          ? {
              identifier: identifier.trim(),
              password,
              captcha: captchaInput.trim(),
              captchaToken: captcha.token,
            }
          : {
              email: email.trim().toLowerCase(),
              password,
              countryCode,
              phone: phone.replace(/\D/g, ""),
              username: username.trim() || null,
              firstName: firstName.trim() || null,
              lastName: lastName.trim() || null,
              captcha: captchaInput.trim(),
              captchaToken: captcha.token,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? (tab === "signin" ? "登录失败" : "注册失败"));
        // 验证码相关错误自动刷新
        if (data.error?.includes("验证码")) {
          captcha.refresh();
          setCaptchaInput("");
        }
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
            {tab === "signin" ? "欢迎回来，继续你的投研工作台" : "完善信息以快速注册"}
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-4 inline-flex rounded border border-border bg-surface p-0.5">
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              resetForm();
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
              resetForm();
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
          {tab === "signin" ? (
            // ----------- 登录 -----------
            <div>
              <label className="label-caps">账号</label>
              <div className="mt-1">
                <FieldShell icon={<User className="h-4 w-4" strokeWidth={1.5} />}>
                  <input
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={baseInputClass}
                    placeholder="邮箱或用户名"
                    autoComplete="username"
                    required
                  />
                </FieldShell>
              </div>
            </div>
          ) : (
            // ----------- 注册 -----------
            <>
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
            </>
          )}

          {/* 密码 */}
          <div>
            <label className="label-caps">密码</label>
            <div className="mt-1">
              <FieldShell
                icon={<KeyRound className="h-4 w-4" strokeWidth={1.5} />}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="ml-2 text-[11px] font-semibold text-muted hover:text-accent"
                  >
                    {showPwd ? "隐藏" : "显示"}
                  </button>
                }
              >
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={baseInputClass}
                  placeholder={tab === "signup" ? "至少 6 位" : "请输入密码"}
                  autoComplete={tab === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={tab === "signup" ? 6 : undefined}
                />
              </FieldShell>
            </div>
          </div>

          {tab === "signup" ? (
            <div>
              <label className="label-caps">确认密码</label>
              <div className="mt-1">
                <FieldShell icon={<KeyRound className="h-4 w-4" strokeWidth={1.5} />}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={baseInputClass}
                    placeholder="再输入一次"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                </FieldShell>
              </div>
            </div>
          ) : null}

          {/* 图形验证码 */}
          <div>
            <label className="label-caps">图形验证码</label>
            <div className="mt-1 flex h-11 items-center gap-2 rounded border border-border bg-surface px-3 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
                <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
              </span>
              <input
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value.replace(/\s/g, ""))}
                className={baseInputClass}
                placeholder="区分大小写不敏感"
                autoComplete="off"
                maxLength={6}
                required
              />
              <button
                type="button"
                onClick={() => {
                  setCaptchaInput("");
                  captcha.refresh();
                }}
                disabled={captcha.loading}
                className="ml-2 flex items-center gap-1 rounded border border-border px-1 py-0.5 text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                aria-label="刷新验证码"
                title="刷新"
              >
                {captcha.loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCaptchaInput("");
                  captcha.refresh();
                }}
                className="ml-1 h-9 overflow-hidden rounded border border-border transition hover:border-accent"
                aria-label="点击刷新验证码"
                title="点击刷新"
                style={{ width: 120 }}
                dangerouslySetInnerHTML={{
                  __html:
                    captcha.svg ||
                    `<svg viewBox="0 0 140 44" xmlns="http://www.w3.org/2000/svg"><rect width="140" height="44" fill="#141418"/></svg>`,
                }}
              />
            </div>
          </div>

          {error ? (
            <p className="rounded border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 px-2 py-1.5 text-[12px] text-[color:var(--danger)]">
              {error}
            </p>
          ) : null}

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
              <span>{tab === "signin" ? "登录" : "注册"}</span>
            )}
          </button>

          <p className="pt-1 text-center text-[12px] text-muted">
            {tab === "signin" ? (
              <>
                还没有账号？
                <button
                  type="button"
                  onClick={() => {
                    setTab("signup");
                    resetForm();
                  }}
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
                  onClick={() => {
                    setTab("signin");
                    resetForm();
                  }}
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
