"use client";

import { ArrowRight } from "lucide-react";
import { usePathname } from "next/navigation";
import type { AnchorHTMLAttributes } from "react";

import { marketingButtonClassName } from "@/components/ui/marketing-button";
import { cn } from "@/lib/cn";

type WaitlistAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  source: "nav" | "hero" | "feature" | "final_cta";
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "default" | "lg";
};

export function WaitlistAnchor({
  children,
  className,
  href,
  onClick,
  size,
  source,
  variant = "primary",
  ...props
}: WaitlistAnchorProps) {
  const pathname = usePathname();
  const resolvedHref = href ?? (pathname === "/" ? "#waitlist" : `/?waitlist_source=${source}#waitlist`);

  return (
    <a
      className={cn(marketingButtonClassName({ size, variant }), className)}
      href={resolvedHref}
      onClick={(event) => {
        window.dispatchEvent(
          new CustomEvent("lumina:waitlist-source", {
            detail: source
          })
        );
        onClick?.(event);
      }}
      {...props}
    >
      <span>{children}</span>
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </a>
  );
}
