import Link from "next/link";
import React, { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

const baseButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70";

const variantClassNames: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--surface-elevated)] disabled:text-[var(--text-muted)]",
  secondary:
    "border border-[var(--accent-border)] bg-[var(--accent-muted)] text-[var(--accent)] hover:border-[var(--accent-border-strong)] hover:bg-[var(--accent-glow)]",
  outline:
    "border border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--hover-subtle)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--hover-subtle)] hover:text-[var(--text-primary)]",
  destructive:
    "border border-[var(--danger-border)] bg-[var(--danger-muted)] text-[var(--danger)] hover:border-[var(--danger-border)] hover:bg-[var(--danger-muted)]"
};

const sizeClassNames: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-2",
  default: "px-4 py-2",
  lg: "min-h-11 px-5 py-2.5",
  icon: "h-11 w-11 min-h-11 shrink-0 p-0"
};

export function buttonClassName({
  className,
  size = "default",
  variant = "primary"
}: {
  className?: string | undefined;
  size?: ButtonSize | undefined;
  variant?: ButtonVariant | undefined;
} = {}) {
  return cn(baseButtonClassName, variantClassNames[variant], sizeClassNames[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingLabel?: string | undefined;
  size?: ButtonSize | undefined;
  variant?: ButtonVariant | undefined;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    isLoading = false,
    loadingLabel = "Working...",
    size,
    variant,
    ...props
  },
  ref
) {
  return (
    <button
      className={buttonClassName({ className, size, variant })}
      disabled={disabled || isLoading}
      ref={ref}
      {...props}
    >
      {isLoading ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            data-loading-spinner=""
          />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

type IconButtonProps = Omit<ButtonProps, "children"> & {
  "aria-label": string;
  children: React.ReactNode;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, className, size = "icon", variant = "ghost", ...props },
  ref
) {
  return (
    <Button className={className} ref={ref} size={size} variant={variant} {...props}>
      {children}
    </Button>
  );
});

type LinkButtonProps = Omit<React.ComponentProps<typeof Link>, "className"> & {
  className?: string | undefined;
  size?: ButtonSize | undefined;
  variant?: ButtonVariant | undefined;
};

export function LinkButton({
  children,
  className,
  href,
  size,
  variant,
  ...props
}: LinkButtonProps) {
  return (
    <Link className={buttonClassName({ className, size, variant })} href={href} {...props}>
      {children}
    </Link>
  );
}
