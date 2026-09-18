import { SignupAnchor } from "@/components/ui/signup-anchor";
import { closingCta } from "@/content/site-copy";
import { getAppLoginUrl } from "@/lib/urls";

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="closing-section" id="get-started">
      <div className="shell-container closing-layout">
        <div>
          <p className="closing-eyebrow"><span className="closing-lime-dot" aria-hidden="true" />GET STARTED</p>
          <h2 id="closing-title">{closingCta.heading}</h2>
          <p className="closing-copy">{closingCta.copy}</p>
        </div>
        <div className="closing-card">
          <span className="data-label">Your workspace</span>
          <strong>Create your Lumina workspace</strong>
          <p>Business details, invoice defaults, and Paystack payout setup in three short steps.</p>
          <div className="closing-actions">
            <SignupAnchor className="w-full" size="lg">
              {closingCta.primary}
            </SignupAnchor>
            <a className="closing-signin" href={getAppLoginUrl()}>
              {closingCta.secondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
