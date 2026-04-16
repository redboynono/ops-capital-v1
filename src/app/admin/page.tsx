import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-20 md:px-6">
        <h1 className="text-3xl font-semibold">Ops Capital Admin</h1>
        <p className="mt-3 text-zinc-400">第一版后台入口已就绪，先从 AI 研报编辑器开始。</p>

        <div className="mt-8">
          <Link
            href="/admin/editor"
            className="inline-flex rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400"
          >
            进入 /admin/editor
          </Link>
        </div>
      </div>
    </div>
  );
}
