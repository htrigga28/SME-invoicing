import { Plus } from "lucide-react";

import { faq } from "@/content/site-copy";

export function FaqSection() {
  return (
    <section className="faq-section" id="faq">
      <div className="shell-container faq-layout">
        <div className="faq-intro">
          <p className="section-signal">Before you join</p>
          <h2>Clear answers for careful operators.</h2>
          <p>
            Lumina is deliberately specific about what it does, where payment truth comes from, and
            which financial responsibilities remain with Paystack and your business.
          </p>
        </div>
        <div className="faq-list">
          {faq.map((item, index) => (
            <details key={item.question} open={index === 0 ? true : undefined}>
              <summary>
                <span>{item.question}</span>
                <span className="faq-plus"><Plus aria-hidden="true" /></span>
              </summary>
              <div className="faq-answer"><p>{item.answer}</p></div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
