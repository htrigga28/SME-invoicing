import { Hero } from "@/components/hero/hero";
import { AudienceBridge } from "@/components/sections/audience-bridge";
import { ClosingCta } from "@/components/sections/closing-cta";
import { CustomerPaymentChapter } from "@/components/sections/customer-payment-chapter";
import { FaqSection } from "@/components/sections/faq-section";
import { InvoiceToCashStory } from "@/components/sections/invoice-to-cash-story";
import { InvoicingChapter } from "@/components/sections/invoicing-chapter";
import { OutcomeExplorer } from "@/components/sections/outcome-explorer";
import { ReceivablesVisibility } from "@/components/sections/receivables-visibility";
import { TrustControls } from "@/components/sections/trust-controls";
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
      <AudienceBridge />
      <InvoiceToCashStory />
      <InvoicingChapter />
      <OutcomeExplorer />
      <ReceivablesVisibility />
      <CustomerPaymentChapter />
      <TrustControls />
      <FaqSection />
      <ClosingCta />
    </main>
  );
}
