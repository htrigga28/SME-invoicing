/**
 * THESIS: Lumina turns invoice-payment ambiguity into one connected trail and refuses the repeated feature-card landing page.
 * OWN-WORLD: Night graphite fields, ledger surfaces, signal lime, and product states joined by a precise route line.
 * STORY: An SME owner sees the outcome, follows how money becomes truth, explores exceptions, and joins the waitlist.
 * FIRST VIEWPORT: A centered owner-facing promise sits above an invoice-to-receipt composition with the main action in immediate reach.
 * FORM: The user-pinned “Payment Trail” direction; no concept seed was required.
 */
import { Hero } from "@/components/hero/hero";
import { ConnectedPaymentTrail } from "@/components/sections/connected-payment-trail";
import { FaqSection } from "@/components/sections/faq-section";
import { OperationsField, TrustArchitecture } from "@/components/sections/home-sections";
import { OutcomeExplorer } from "@/components/sections/outcome-explorer";
import { WaitlistSection } from "@/components/sections/waitlist-section";
import { getAllJsonLd } from "@/lib/seo";

export default function HomePage() {
  return (
    <main>
      {getAllJsonLd().map((item) => (
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          key={item["@type"]}
          type="application/ld+json"
        />
      ))}
      <Hero />
      <ConnectedPaymentTrail />
      <OutcomeExplorer />
      <OperationsField />
      <TrustArchitecture />
      <FaqSection />
      <WaitlistSection />
    </main>
  );
}
