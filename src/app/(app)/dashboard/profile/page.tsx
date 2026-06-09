import { redirect } from "next/navigation";
import { BriefingToggle } from "@/components/briefing-toggle";
import { ManageSubscriptionButton } from "@/components/manage-subscription-button";
import { ProfileForm } from "@/components/profile-form";
import { getSessionUser } from "@/lib/auth";
import { isSubscriptionActive } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function DashboardProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6 md:px-6">
      <header className="mb-4 border-b border-border pb-3">
        <span className="label-caps">资料与安全</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">账户</h1>
      </header>

      <div className="card p-4">
        <dl className="divide-y divide-border text-[13px]">
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted">邮箱</dt>
            <dd className="font-mono">{user.email}</dd>
          </div>
          <div className="flex items-center justify-between py-2">
            <dt className="text-muted">订阅状态</dt>
            <dd className="text-accent-strong">{user.subscriptionStatus}</dd>
          </div>
          {user.subscriptionEndDate ? (
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted">本期到期</dt>
              <dd className="font-mono">
                {new Date(user.subscriptionEndDate).toLocaleDateString("zh-CN")}
              </dd>
            </div>
          ) : null}
        </dl>

        {isSubscriptionActive({
          subscriptionStatus: user.subscriptionStatus,
          subscriptionEndDate: user.subscriptionEndDate,
        }) ? (
          <div className="mt-3 border-t border-border pt-3">
            <ManageSubscriptionButton />
          </div>
        ) : null}
      </div>

      <section className="card mt-4 p-4">
        <h2 className="mb-1 text-[13px] font-bold text-foreground">通知偏好</h2>
        <BriefingToggle initialEnabled={user.emailBriefingEnabled} />
      </section>

      <ProfileForm initialFullName={user.fullName ?? ""} />
    </div>
  );
}
