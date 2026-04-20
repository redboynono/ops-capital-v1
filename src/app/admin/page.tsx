import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="relative overflow-hidden pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(176,139,87,0.14),transparent_40%)]" />

      <div className="relative mx-auto w-full max-w-4xl px-4 pb-8 pt-14 md:px-6 md:pt-20">
        <section className="rise-in">
          <p className="text-xs uppercase tracking-[0.34em] text-accent-soft/85">后台</p>
          <h1 className="mt-4 font-[var(--font-brand-serif)] text-5xl leading-[1.05] text-foreground md:text-6xl">
            Ops Capital 后台控制台
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
            运营入口。先进入 AI 研报编辑器生成与发布机构级研报。
          </p>
        </section>

        <div className="rise-in mt-10 flex flex-wrap gap-3" style={{ animationDelay: "80ms" }}>
          <Link href="/admin/editor" className="primary-cta rounded-full px-6 py-3 text-sm font-semibold tracking-wide">
            打开 AI 编辑器
          </Link>
          <Link href="/reports" className="ghost-cta rounded-full px-6 py-3 text-sm font-semibold tracking-wide">
            查看研报
          </Link>
        </div>
      </div>
    </div>
  );
}
