"use client";

import { CheckCircle2, CreditCard, FileText, ReceiptText, ShieldCheck } from "lucide-react";
import { LazyMotion, useReducedMotion, useScroll } from "motion/react";
import * as m from "motion/react-m";
import { useRef } from "react";

import { paymentTrail } from "@/content/site-copy";

const loadMotionFeatures = () => import("@/lib/motion-features").then((module) => module.default);

const stageIcons = {
  invoice: FileText,
  checkout: CreditCard,
  confirmation: ShieldCheck,
  match: CheckCircle2,
  receipt: ReceiptText
};

export function ConnectedPaymentTrail() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 72%", "end 42%"]
  });

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

        <LazyMotion features={loadMotionFeatures} strict>
          <div className="stage-rail-wrap">
            <div aria-hidden="true" className="stage-rail" />
            <m.div
              aria-hidden="true"
              className="stage-rail-progress"
              style={{ scaleX: reduceMotion ? 1 : scrollYProgress }}
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
                    <span className="stage-meta">{stage.meta}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </LazyMotion>

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
