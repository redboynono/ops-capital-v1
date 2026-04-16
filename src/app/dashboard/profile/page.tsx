import { createClient } from "@/lib/supabase/server";

export default async function DashboardProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, subscription_status")
    .eq("id", user?.id)
    .single();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-semibold">Profile</h1>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <dt className="text-zinc-400">Email</dt>
              <dd className="text-zinc-100">{user?.email ?? "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
              <dt className="text-zinc-400">Full Name</dt>
              <dd className="text-zinc-100">{profile?.full_name ?? "未设置"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-zinc-400">Subscription</dt>
              <dd className="text-zinc-100">{profile?.subscription_status ?? "inactive"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
