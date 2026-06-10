export default function NewsLoading() {
  return (
    <div className="mx-auto w-full max-w-[960px] animate-pulse px-4 py-6 md:px-6">
      <div className="mb-4 h-16 border-b border-border pb-3">
        <div className="h-3 w-20 rounded bg-surface-muted" />
        <div className="mt-2 h-7 w-40 rounded bg-surface-muted" />
      </div>
      <div className="card space-y-0 px-4 py-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="border-b border-border py-4">
            <div className="h-3 w-28 rounded bg-surface-muted" />
            <div className="mt-2 h-5 w-full max-w-sm rounded bg-surface-muted" />
            <div className="mt-2 h-4 w-full rounded bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
