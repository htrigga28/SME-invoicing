import { ArrowDown } from "lucide-react";

import { PaymentTrailVisual } from "@/components/hero/payment-trail-visual";
import { WaitlistAnchor } from "@/components/ui/waitlist-anchor";
import { hero } from "@/content/site-copy";

export function Hero() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div aria-hidden="true" className="hero-orbits">
        <span />
        <span />
        <span />
      </div>

      <div className="shell-container hero-copy">
        <p className="hero-kicker">{hero.eyebrow}</p>
        <h1 id="hero-title">{hero.title}</h1>
        <p className="hero-support">{hero.copy}</p>
        <div className="hero-actions">
          <WaitlistAnchor size="lg" source="hero">
            {hero.primaryCta}
          </WaitlistAnchor>
          <a className="text-action" href="#payment-trail">
            <span>{hero.secondaryCta}</span>
            <ArrowDown aria-hidden="true" className="h-4 w-4" />
          </a>
        </div>
        <p className="hero-trust">{hero.trustNote}</p>
      </div>

      <div className="shell-container hero-proof-wrap">
        <PaymentTrailVisual />
      </div>
    </section>
  );
}
