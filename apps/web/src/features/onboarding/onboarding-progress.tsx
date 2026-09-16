import React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";

const steps = [
  { label: "Account", shortLabel: "Account" },
  { label: "Business profile", shortLabel: "Business" },
  { label: "Payment Setup", shortLabel: "Payments" }
] as const;

export function OnboardingProgress({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Signup progress">
      <p className="text-sm font-semibold text-[var(--text-primary)]">
        Step {currentStep} of {steps.length}
      </p>
      <ol className="mt-3 grid grid-cols-3 gap-2" role="list">
        {steps.map((step, index) => {
          const stepNumber = (index + 1) as 1 | 2 | 3;
          const isComplete = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <li aria-current={isCurrent ? "step" : undefined} className="min-w-0" key={step.label}>
              <div
                className={cn(
                  "h-1 rounded-full bg-[var(--surface-elevated)]",
                  (isComplete || isCurrent) && "bg-[var(--accent)]"
                )}
              />
              <div className="mt-2 flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--surface-raised)] text-xs font-semibold text-[var(--text-muted)]",
                    isCurrent &&
                      "border-[var(--accent-border-strong)] bg-[var(--accent)] text-[var(--accent-foreground)]",
                    isComplete &&
                      "border-[var(--success-border)] bg-[var(--success-muted)] text-[var(--success)]"
                  )}
                >
                  {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                </span>
                <span className="min-w-0">
                  <span className="sr-only">
                    {isComplete ? "Completed" : isCurrent ? "Current step" : "Upcoming"}:{" "}
                  </span>
                  <span className="hidden text-xs font-semibold text-[var(--text-primary)] sm:block">
                    {step.label}
                  </span>
                  <span className="block text-xs font-semibold text-[var(--text-primary)] sm:hidden">
                    {step.shortLabel}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-0.5 hidden text-[11px] text-[var(--text-muted)] sm:block"
                  >
                    {isComplete ? "Completed" : isCurrent ? "Current step" : "Upcoming"}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
