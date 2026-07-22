import Link from "next/link";
import React, { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline";
type ButtonSize = "default" | "lg" | "icon";

const baseClassName =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] text-sm font-semibold transition-[transform,background-color,color,border-color] duration-[160ms] ease-[var(--ease-out)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:opacity-70";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] px-5 py-2.5 text-[var(--accent-foreground)] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] active:translate-y-0",
  secondary:
    "bg-[var(--surface-raised)] px-5 py-2.5 text-[var(--text-primary)] hover:-translate-y-0.5 hover:bg-[var(--surface-elevated)]",
  ghost:
    "px-4 py-2.5 text-[var(--text-secondary)] hover:bg-[var(--hover-subtle)] hover:text-[var(--text-primary)]",
  outline:
    "border border-[var(--border-default)] px-5 py-2.5 text-[var(--text-primary)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--hover-subtle)]"
};

const sizes: Record<ButtonSize, string> = {
  default: "",
  lg: "min-h-12 px-6 text-base",
  icon: "h-11 w-11 min-h-11 shrink-0 p-0"
};

export function marketingButtonClassName({
  className,
  size = "default",
  variant = "primary"
}: {
  className?: string | undefined;
  size?: ButtonSize | undefined;
  variant?: ButtonVariant | undefined;
} = {}) {
  return cn(baseClassName, variants[variant], sizes[size], className);
}

type MarketingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingLabel?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export const MarketingButton = forwardRef<HTMLButtonElement, MarketingButtonProps>(
  function MarketingButton(
    {
      children,
      className,
      disabled,
      isLoading = false,
      loadingLabel = "Submitting...",
      size,
      variant,
      ...props
    },
    ref
  ) {
    return (
      <button
        className={marketingButtonClassName({ className, size, variant })}
        disabled={disabled || isLoading}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
            <span>{loadingLabel}</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

type MarketingLinkButtonProps = Omit<React.ComponentProps<typeof Link>, "className"> & {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function MarketingLinkButton({
  children,
  className,
  href,
  size,
  variant,
  ...props
}: MarketingLinkButtonProps) {
  return (
    <Link className={marketingButtonClassName({ className, size, variant })} href={href} {...props}>
      {children}
    </Link>
  );
}
