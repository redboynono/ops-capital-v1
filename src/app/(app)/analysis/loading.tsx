export default function AnalysisLoading() {
  return (
    <div className="mx-auto w-full max-w-[960px] animate-pulse px-4 py-6 md:px-6">
      <div className="mb-4 h-20 border-b border-border pb-3">
        <div className="h-3 w-24 rounded bg-surface-muted" />
        <div className="mt-2 h-7 w-48 rounded bg-surface-muted" />
      </div>
      <div className="mb-4 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-7 w-16 rounded bg-surface-muted" />
        ))}
      </div>
      <div className="card space-y-0 px-4 py-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="border-b border-border py-4">
            <div className="h-3 w-20 rounded bg-surface-muted" />
            <div className="mt-2 h-5 w-full max-w-md rounded bg-surface-muted" />
            <div className="mt-2 h-4 w-full rounded bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
