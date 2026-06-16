import { redirect } from "next/navigation";

import { AlertsManager } from "@/components/alerts-manager";
import { listAlertsForUser } from "@/lib/alerts";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "实时提醒 · OPS Alpha",
};

export default async function AlertsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const alerts = await listAlertsForUser(user.id);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">Alerts</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">实时提醒</h1>
        <p className="mt-1 text-[13px] text-muted">
          价格 / 涨跌幅触发时邮件通知 · 美股交易时段每 15 分钟检查一次 · 冷却期防止重复打扰
        </p>
      </header>

      <AlertsManager initialAlerts={alerts} />

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        说明：暂仅支持美股。「现价」类规则使用 Finnhub /quote 实时价格；「今日涨跌幅」使用 dp 字段（相对昨日收盘）。冷却期内不再触发；暂停后恢复会清空"最近触发"。
      </p>
    </div>
  );
}
