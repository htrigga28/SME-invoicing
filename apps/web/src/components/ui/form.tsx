import React, {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type TextareaHTMLAttributes
} from "react";

import { cn } from "@/lib/cn";

export const controlClassName =
  "w-full rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--text-primary)] transition duration-200 placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] disabled:cursor-not-allowed disabled:bg-[var(--surface-elevated)] disabled:text-[var(--text-muted)]";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input className={cn(controlClassName, className)} ref={ref} {...props} />;
  }
);

export const DateInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function DateInput({ className, type = "date", ...props }, ref) {
    return (
      <Input className={cn("font-mono tabular-nums", className)} ref={ref} type={type} {...props} />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea className={cn(controlClassName, "min-h-24", className)} ref={ref} {...props} />;
});

export function FormField({ className, ...props }: HTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block", className)} {...props} />;
}

export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("text-sm font-semibold text-[var(--text-secondary)]", className)}
      {...props}
    />
  );
}

export function FieldHint({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-xs text-[var(--text-muted)]", className)} {...props} />;
}

export function FieldError({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("mt-1 block text-sm text-[var(--danger)]", className)} {...props} />;
}
