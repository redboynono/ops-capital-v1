import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { mysqlQuery } from "@/lib/mysql";
import { AdminEarningsPanel, type EarningsAdminRow } from "@/components/admin-earnings-panel";

export const dynamic = "force-dynamic";

export default async function AdminEarningsPage() {
  const auth = await requireAdmin();
  if (!auth.user) redirect("/login");
  if (!auth.ok) {
    return (
      <div className="mx-auto max-w-[640px] px-4 py-10">
        <h1 className="text-2xl font-bold">403 · 没有后台权限</h1>
      </div>
    );
  }

  const rows = await mysqlQuery<EarningsAdminRow[]>(
    `select er.id, er.symbol, er.fiscal_year, er.fiscal_quarter,
            date_format(er.report_date, '%Y-%m-%d') as report_date,
            er.hour,
            er.eps_actual, er.eps_estimate,
            er.revenue_actual, er.revenue_estimate,
            er.post_id,
            p.slug as post_slug,
            er.generation_attempts, er.last_error,
            er.audit_summary
       from earnings_releases er
       left join posts p on p.id = er.post_id
      order by er.report_date desc, er.symbol`,
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6">
      <nav className="text-[12px] text-muted">
        <Link href="/admin" className="hover:text-accent-strong">后台</Link>
        <span className="mx-1">/</span>
        <span>财报流水线</span>
      </nav>

      <header className="mt-3 mb-4 border-b border-border pb-3">
        <span className="label-caps">Earnings Pipeline</span>
        <h1 className="mt-1 text-2xl font-bold text-foreground">财报流水线管理</h1>
        <p className="mt-1 text-[13px] text-muted">
          覆盖标的的财报发布 + AI 深度文章自动化。支持手动扫描 & 重试失败的文章生成。
        </p>
      </header>

      <AdminEarningsPanel rows={rows} />
    </div>
  );
}
