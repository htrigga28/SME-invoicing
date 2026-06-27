import { DashboardShell } from "@/features/dashboard/dashboard-shell";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <DashboardShell />
      </div>
    </main>
  );
}
