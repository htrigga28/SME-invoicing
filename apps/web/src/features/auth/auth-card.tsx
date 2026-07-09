type AuthCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6">
        <div className="mb-6">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--accent-border-subtle)] bg-[var(--accent-muted)] text-sm font-black text-[var(--accent)]">
            SI
          </div>
          <p className="text-xs font-semibold uppercase text-[var(--accent)]">SME Invoicing</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
