"use client";

import { CheckCircle2, CreditCard, FileText, ReceiptText, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NairaText } from "@/components/ui/naira-text";
import { paymentTrail } from "@/content/site-copy";

const stageIcons = {
  invoice: FileText,
  checkout: CreditCard,
  confirmation: ShieldCheck,
  match: CheckCircle2,
  receipt: ReceiptText
};

export function ConnectedPaymentTrail() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const section = sectionRef.current;
      const progressBar = progressRef.current;
      if (!section || !progressBar) return;
      const range = Math.max(section.offsetHeight - window.innerHeight * 0.3, 1);
      const progress = Math.max(0, Math.min(1, (window.innerHeight * 0.72 - section.getBoundingClientRect().top) / range));
      progressBar.style.transform = `scaleX(${reduceMotion ? 1 : progress})`;
    };
    update();
    if (reduceMotion) return;
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [reduceMotion]);

  return (
    <section className="story-section" id="payment-trail" ref={sectionRef}>
      <div className="shell-container">
        <div className="story-intro">
          <div>
            <p className="section-signal">One connected record</p>
            <h2>From invoice sent to payment understood.</h2>
          </div>
          <p>
            Payment collection is only useful when the business can explain what happened next.
            Lumina keeps the customer, reference, settlement route, balance, and receipt attached to
            the same financial story.
          </p>
        </div>

        <div className="stage-rail-wrap">
            <div aria-hidden="true" className="stage-rail" />
            <div
              aria-hidden="true"
              className="stage-rail-progress"
              ref={progressRef}
            />
            <ol className="stage-list">
              {paymentTrail.map((stage) => {
                const Icon = stageIcons[stage.id];
                return (
                  <li key={stage.id}>
                    <div className="stage-node"><Icon aria-hidden="true" /></div>
                    <span className="stage-label">{stage.label}</span>
                    <h3>{stage.title}</h3>
                    <p>{stage.copy}</p>
                    <span className="stage-meta"><NairaText value={stage.meta} /></span>
                  </li>
                );
              })}
            </ol>
          </div>

        <div className="settlement-branch">
          <span className="branch-route" aria-hidden="true" />
          <div>
            <span className="data-label">SETTLEMENT BRANCH</span>
            <strong>The payout route is confirmed before the customer can pay online.</strong>
          </div>
          <p>Resolve the bank account, confirm the account name, and activate the organisation Paystack subaccount.</p>
        </div>
      </div>
    </section>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}
