import { redirect } from "next/navigation";

import { AlertsManager } from "@/components/alerts-manager";
import { listAlertsForUser } from "@/lib/alerts";
import { getSessionUser } from "@/lib/auth";
import { getDictionary, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const a = getDictionary(locale).memberPages.alerts;
  const alerts = await listAlertsForUser(user.id);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">{a.label}</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{a.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{a.subtitle}</p>
      </header>

      <AlertsManager initialAlerts={alerts} />

      <p className="mt-6 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-soft">
        {a.disclaimer}
      </p>
    </div>
  );
}
