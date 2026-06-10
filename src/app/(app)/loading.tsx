export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[1200px] animate-pulse px-4 py-6 md:px-6">
      <div className="h-24 rounded-sm bg-surface-muted" />
      <div className="mt-5 h-40 rounded-sm bg-surface-muted" />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="h-48 rounded-sm bg-surface-muted" />
        <div className="h-48 rounded-sm bg-surface-muted" />
      </div>
    </div>
  );
}
