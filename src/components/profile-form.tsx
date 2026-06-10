"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const input =
  "w-full rounded border border-border bg-surface px-3 py-2 text-[13px] outline-none placeholder:text-muted-soft focus:border-accent";

export function ProfileForm({ initialFullName }: { initialFullName: string }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialFullName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileErr(null);
    setProfileMsg(null);
    try {
      setSavingProfile(true);
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "保存失败");
      setProfileMsg("姓名已更新");
      router.refresh();
    } catch (err) {
      setProfileErr(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdErr(null);
    setPwdMsg(null);
    if (newPassword.length < 6) return setPwdErr("新密码至少 6 位");
    if (newPassword !== confirmPassword) return setPwdErr("两次输入的新密码不一致");

    try {
      setSavingPassword(true);
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "修改失败");
      setPwdMsg("密码已更新");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwdErr(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <form onSubmit={onSaveProfile} className="card mt-4 space-y-3 p-4">
        <p className="label-caps">基本资料</p>
        <div>
          <label className="label-caps">姓名</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
        </div>
        {profileErr ? <p className="text-[12px] text-[color:var(--danger)]">{profileErr}</p> : null}
        {profileMsg ? <p className="text-[12px] text-[color:var(--success)]">{profileMsg}</p> : null}
        <button type="submit" disabled={savingProfile} className="btn-primary px-3 py-1.5 text-[12px]">
          {savingProfile ? "保存中..." : "保存姓名"}
        </button>
      </form>

      <form onSubmit={onChangePassword} className="card mt-4 space-y-3 p-4">
        <p className="label-caps">安全 · 修改密码</p>
        <div>
          <label className="label-caps">当前密码</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={input}
            required
          />
        </div>
        <div>
          <label className="label-caps">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            className={input}
            required
          />
        </div>
        <div>
          <label className="label-caps">确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
            className={input}
            required
          />
        </div>
        {pwdErr ? <p className="text-[12px] text-[color:var(--danger)]">{pwdErr}</p> : null}
        {pwdMsg ? <p className="text-[12px] text-[color:var(--success)]">{pwdMsg}</p> : null}
        <button type="submit" disabled={savingPassword} className="btn-primary px-3 py-1.5 text-[12px]">
          {savingPassword ? "更新中..." : "更新密码"}
        </button>
      </form>
    </>
  );
}
