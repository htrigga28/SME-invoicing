import { EyeOff, KeyRound, ShieldCheck, UsersRound } from "lucide-react";

import { marketingDemo, trustSection } from "@/content/site-copy";

const icons: Record<string, typeof ShieldCheck> = {
  provider: ShieldCheck,
  keys: KeyRound,
  masked: EyeOff,
  roles: UsersRound
};

export function TrustControls() {
  return (
    <section aria-labelledby="trust-title" className="trust-section" id="trust">
      <div className="shell-container">
        <div className="trust-intro">
          <p className="section-eyebrow">{trustSection.eyebrow}</p>
          <h2 id="trust-title">{trustSection.heading}</h2>
          <p>{trustSection.body}</p>
        </div>

        <div className="trust-rows">
          {trustSection.rows.map((row) => {
            const Icon = icons[row.id] ?? ShieldCheck;
            return (
              <article className="trust-row" key={row.id}>
                <span className="trust-row-icon"><Icon aria-hidden="true" /></span>
                <div>
                  <h3>{row.title}</h3>
                  <p>{row.detail}</p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="trust-proof" aria-label="Illustrative control context">
          <div className="trust-proof-card"><ShieldCheck aria-hidden="true" size={15} /><span>Payment setup · <strong>Active · ****4821</strong></span></div>
          <div className="trust-proof-card"><UsersRound aria-hidden="true" size={15} /><span>Audit · <strong>{marketingDemo.receiptNumber} issued</strong></span></div>
        </div>
      </div>
    </section>
  );
}
