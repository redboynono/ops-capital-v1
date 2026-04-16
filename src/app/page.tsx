import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-24 md:px-6">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Ops Capital</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          机构级宏观与科技投研引擎
        </h1>
        <p className="mt-6 max-w-2xl text-zinc-400">
          V1 第一版已上线：支持基于 CIO 框架的一键生成研报草稿，并在后台编辑区完成标题、摘要和正文回填。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/reports"
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            查看研报
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-emerald-500/60 px-4 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-300"
          >
            订阅方案
          </Link>
          <Link
            href="/admin/editor"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500"
          >
            打开 Admin Editor
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500"
          >
            后台入口
          </Link>
        </div>
      </main>
    </div>
  );
}
