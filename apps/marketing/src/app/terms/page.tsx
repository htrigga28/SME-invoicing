import type { Metadata } from "next";

import { LegalPage } from "@/components/layout/legal-page";
import { siteConfig } from "@/content/site-copy";

export const metadata: Metadata = {
  title: "Terms",
  description: "Draft terms for Lumina workspace access.",
  alternates: { canonical: "/terms" }
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Terms" title="Workspace terms">
      <section>
        <h2>Product changes</h2>
        <p>
          Lumina&apos;s product information, workflows, availability, and supported features may
          change as the service develops.
        </p>
      </section>
      <section>
        <h2>Account access</h2>
        <p>
          You are responsible for providing accurate signup information and keeping your account
          credentials secure. Service availability is not guaranteed to be uninterrupted.
        </p>
      </section>
      <section>
        <h2>Product boundaries</h2>
        <p>
          Lumina focuses on invoice payment reconciliation. It does not provide wallet balances,
          withdrawals, payroll, inventory, or full bookkeeping.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          Questions about these draft terms can be sent to{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
