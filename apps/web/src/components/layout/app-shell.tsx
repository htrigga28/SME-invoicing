type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <span className="text-sm font-semibold text-slate-950">SME Invoicing</span>
          <span className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
            Tooling foundation
          </span>
        </div>
      </header>
      {children}
    </main>
  );
}
