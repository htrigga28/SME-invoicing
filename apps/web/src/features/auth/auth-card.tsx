import { BrandLogo } from "@/components/brand/brand-logo";

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
          <BrandLogo className="mb-5" />
          <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
