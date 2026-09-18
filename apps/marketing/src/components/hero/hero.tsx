import { ArrowDown } from "lucide-react";

import { SignupAnchor } from "@/components/ui/signup-anchor";
import { hero } from "@/content/site-copy";

import { InvoiceHeroScene } from "./invoice-hero-scene";

export function Hero() {
  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="shell-container hero-grid">
        <div className="hero-copy">
          <p className="hero-kicker">{hero.eyebrow}</p>
          <h1 id="hero-title">{hero.title}</h1>
          <p className="hero-support">{hero.copy}</p>
          <div className="hero-actions">
            <SignupAnchor size="lg">{hero.primaryCta}</SignupAnchor>
            <a className="hero-secondary" href={hero.secondaryHref}>
              <span>{hero.secondaryCta}</span>
              <ArrowDown aria-hidden="true" />
            </a>
          </div>
          <p className="hero-trust">{hero.trustNote}</p>
        </div>
        <div className="hero-scene">
          <InvoiceHeroScene />
        </div>
      </div>
    </section>
  );
}
