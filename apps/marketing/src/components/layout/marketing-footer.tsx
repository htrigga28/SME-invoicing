"use client";

import { ArrowUpRight } from "lucide-react";
import { usePathname } from "next/navigation";

import { BrandLogo } from "@/components/brand/brand-logo";
import { WaitlistAnchor } from "@/components/ui/waitlist-anchor";
import { footer, navigation } from "@/content/site-copy";
import { getAppLoginUrl, getMarketingAnchorHref } from "@/lib/urls";

export function MarketingFooter() {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();
  const resolveHref = (href: `#${string}`) => getMarketingAnchorHref(pathname, href);

  return (
    <footer className="marketing-footer">
      <div className="shell-container footer-lead">
        <div>
          <span className="data-label">THE PAYMENT TRAIL</span>
          <h2>{footer.heading}</h2>
        </div>
        <WaitlistAnchor source="final_cta">Join the waitlist</WaitlistAnchor>
      </div>

      <div className="shell-container footer-grid">
        <div className="footer-brand">
          <BrandLogo />
          <p>{footer.descriptor}</p>
          <span>{footer.boundaryNote}</span>
        </div>
        <FooterGroup
          links={navigation.productItems.map((item) => ({ href: resolveHref(item.href), label: item.label }))}
          title="Product"
        />
        <FooterGroup
          links={[
            ...navigation.links.map((item) => ({ href: resolveHref(item.href), label: item.label })),
            { href: getAppLoginUrl(), label: "Sign In" }
          ]}
          title="Explore"
        />
        <FooterGroup links={[{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }]} title="Legal" />
      </div>
      <div className="shell-container footer-bottom">
        <p>&copy; {currentYear} Lumina</p>
        <a href={resolveHref("#waitlist")}>Early access <ArrowUpRight aria-hidden="true" /></a>
      </div>
    </footer>
  );
}

function FooterGroup({ links, title }: { links: Array<{ href: string; label: string }>; title: string }) {
  return (
    <div className="footer-group">
      <h3>{title}</h3>
      <ul>
        {links.map((link) => <li key={`${title}-${link.href}`}><a href={link.href}>{link.label}</a></li>)}
      </ul>
    </div>
  );
}
