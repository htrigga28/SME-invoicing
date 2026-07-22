import type { Metadata } from "next";

import { LegalPage } from "@/components/layout/legal-page";
import { siteConfig } from "@/content/site-copy";

export const metadata: Metadata = {
  title: "Terms",
  description: "Pre-release terms for Lumina early access.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="Early-access terms">
      <section>
        <h2>Pre-release product</h2>
        <p>Lumina is an early-access product. Product information, workflows, availability, and supported features may change before wider public release.</p>
      </section>
      <section>
        <h2>Availability</h2>
        <p>Joining the waitlist does not guarantee an invitation date, product availability, or uninterrupted access.</p>
      </section>
      <section>
        <h2>Product boundaries</h2>
        <p>Lumina focuses on invoice payment reconciliation. It does not provide wallet balances, withdrawals, payroll, inventory, or full bookkeeping.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about these draft terms can be sent to <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.</p>
      </section>
    </LegalPage>
  );
}
