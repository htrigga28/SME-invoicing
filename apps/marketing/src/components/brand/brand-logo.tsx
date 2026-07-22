import { Zap } from "lucide-react";

import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] bg-[var(--accent)] text-[var(--accent-foreground)]",
        className
      )}
    >
      <Zap className="h-4 w-4 fill-current" />
    </span>
  );
}

export function BrandLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandMark />
      <span className="text-base font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Lumina</span>
    </span>
  );
}
