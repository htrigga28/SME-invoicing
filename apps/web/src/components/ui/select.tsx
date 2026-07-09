import React, { forwardRef, type SelectHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

import { controlClassName } from "./form";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, className = "", wrapperClassName = "", ...props },
  ref
) {
  return (
    <span className={cn("relative block w-full", wrapperClassName)}>
      <select
        className={cn(controlClassName, "appearance-none py-2 pl-3 pr-12", className)}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
        data-testid="select-chevron"
        fill="none"
        viewBox="0 0 20 20"
      >
        <path
          d="m6 8 4 4 4-4"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
        />
      </svg>
    </span>
  );
});
