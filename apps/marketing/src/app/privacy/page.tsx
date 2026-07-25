import type { Metadata } from "next";

import { LegalPage } from "@/components/layout/legal-page";
import { siteConfig } from "@/content/site-copy";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Lumina handles early-access waitlist information.",
  alternates: { canonical: "/privacy" }
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Privacy" title="Waitlist privacy notice">
      <section>
        <h2>Data we collect</h2>
        <p>The Lumina waitlist collects your work email and, where provided, your name, business name, role, referral URL, UTM context, and waitlist CTA source.</p>
      </section>
      <section>
        <h2>How we use it</h2>
        <p>We use waitlist information to manage early-access interest, understand which public pages or campaigns are working, and contact you when Lumina early access opens.</p>
      </section>
      <section>
        <h2>Selling information</h2>
        <p>Lumina does not sell waitlist information.</p>
      </section>
      <section>
        <h2>Removal requests</h2>
        <p>You can request removal from the waitlist by contacting <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>.</p>
      </section>
    </LegalPage>
  );
}
