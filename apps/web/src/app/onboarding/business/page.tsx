import { BusinessOnboardingForm } from "@/features/onboarding/business-onboarding-form";

export default function BusinessOnboardingPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-teal-700">
          Business onboarding
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">
          Complete your business profile
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          This customer-facing profile is required before accessing the dashboard.
        </p>
        <div className="mt-8">
          <BusinessOnboardingForm />
        </div>
      </section>
    </main>
  );
}
