import type { Metadata } from "next";

import { LegalPage } from "@/components/layout/legal-page";
import { siteConfig } from "@/content/site-copy";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Lumina handles account and business information.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Privacy notice">
      <section>
        <h2>Data we collect</h2>
        <p>
          Lumina collects the account, business profile, invoice, customer, and payment-operation
          information needed to provide the workspace. Passwords are stored as hashes, and payout
          account details are masked after Paystack setup.
        </p>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>
          We use this information to secure your workspace, generate invoices and receipts, connect
          provider-confirmed payments, and show your organisation&apos;s operational records.
        </p>
      </section>
      <section>
        <h2>Selling information</h2>
        <p>Lumina does not sell account or business information.</p>
      </section>
      <section>
        <h2>Removal requests</h2>
        <p>
          You can ask about your information or request account removal by contacting{" "}
          <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.
        </p>
      </section>
    </LegalPage>
  );
}
