export default function WorkspaceLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading workspace content"
      className="space-y-6"
      role="status"
    >
      <div className="space-y-3">
        <div className="h-9 w-52 animate-pulse rounded-lg bg-[var(--surface-raised)]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--surface-raised)]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            className="h-32 animate-pulse rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
            key={index}
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)]" />
    </div>
  );
}
