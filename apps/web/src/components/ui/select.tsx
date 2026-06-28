import React, { forwardRef, type SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { children, className = "", wrapperClassName = "", ...props },
  ref
) {
  return (
    <span className={`relative block w-full ${wrapperClassName}`}>
      <select
        className={`w-full appearance-none rounded-md border border-slate-300 bg-white py-2 pl-3 pr-12 text-sm text-slate-950 shadow-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/25 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600"
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
