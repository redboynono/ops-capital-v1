import { getSessionUser } from "@/lib/auth";

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  // 若未配置 ADMIN_EMAILS，则在开发环境放开；生产要求显式配置
  if (list.length === 0) return process.env.NODE_ENV !== "production";
  return list.includes(email.toLowerCase());
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { user: null, ok: false as const };
  return { user, ok: isAdminEmail(user.email) };
}
