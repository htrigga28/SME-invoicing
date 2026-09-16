import { ArrowRight } from "lucide-react";
import type { AnchorHTMLAttributes } from "react";

import { marketingButtonClassName } from "@/components/ui/marketing-button";
import { cn } from "@/lib/cn";
import { getAppRegisterUrl } from "@/lib/urls";

type SignupAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "default" | "lg";
};

export function SignupAnchor({
  children,
  className,
  href = getAppRegisterUrl(),
  size,
  variant = "primary",
  ...props
}: SignupAnchorProps) {
  return (
    <a
      className={cn(marketingButtonClassName({ size, variant }), className)}
      href={href}
      {...props}
    >
      <span>{children}</span>
      <ArrowRight aria-hidden="true" className="h-4 w-4" />
    </a>
  );
}
