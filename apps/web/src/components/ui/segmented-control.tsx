import React from "react";

import { cn } from "@/lib/cn";

type SegmentedControlOption<T extends string> = {
  label: string;
  value: T;
};

export function SegmentedControl<T extends string>({
  className,
  label,
  onChange,
  options,
  value
}: {
  className?: string | undefined;
  label: string;
  onChange: (value: T) => void;
  options: Array<SegmentedControlOption<T>>;
  value: T;
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-1",
        className
      )}
      role="tablist"
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            aria-selected={selected}
            className={cn(
              "min-h-10 rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] transition duration-200 hover:bg-[var(--hover-subtle)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              selected &&
                "bg-[var(--accent-muted)] text-[var(--accent)] [box-shadow:inset_0_0_0_1px_var(--accent-border)]"
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
