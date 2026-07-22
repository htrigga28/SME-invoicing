"use client";

import {
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck
} from "lucide-react";
import { LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useState } from "react";

import { hero } from "@/content/site-copy";

const loadMotionFeatures = () => import("@/lib/motion-features").then((module) => module.default);

const enterTransition = { duration: 0.52, ease: [0.22, 1, 0.36, 1] as const };

export function PaymentTrailVisual() {
  const reduceMotion = useReducedMotion();
  const [motionReady, setMotionReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMotionReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const enter = (delay: number, x = 0, y = 18) => ({
    initial: !motionReady || reduceMotion ? false : { opacity: 0, x, y, filter: "blur(8px)" },
    animate: { opacity: 1, x: 0, y: 0, filter: "blur(0px)" },
    transition: reduceMotion ? { duration: 0.01 } : { ...enterTransition, delay }
  });

  return (
    <LazyMotion features={loadMotionFeatures} strict>
      <div className="trail-window" aria-label="Illustrative connected payment trail">
        <div className="trail-window-bar">
          <div aria-hidden="true" className="window-controls">
            <span />
            <span />
            <span />
          </div>
          <span>{hero.previewLabel}</span>
          <span className="demo-label">{hero.demoLabel}</span>
        </div>

        <div className="trail-canvas">
          <m.div
            aria-hidden="true"
            className="trail-route trail-route-main"
            initial={!motionReady || reduceMotion ? false : { scaleX: 0 }}
            key={`main-${motionReady ? "motion" : "static"}`}
            animate={{ scaleX: 1 }}
            transition={reduceMotion ? { duration: 0.01 } : { duration: 0.9, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          />
          <m.div
            aria-hidden="true"
            className="trail-route trail-route-branch"
            initial={!motionReady || reduceMotion ? false : { scaleY: 0 }}
            key={`branch-${motionReady ? "motion" : "static"}`}
            animate={{ scaleY: 1 }}
            transition={reduceMotion ? { duration: 0.01 } : { duration: 0.52, delay: 0.58, ease: [0.22, 1, 0.36, 1] }}
          />

          <m.article className="trail-panel invoice-panel" key={`invoice-${motionReady ? "motion" : "static"}`} {...enter(0.08, -18, 0)}>
            <div className="panel-heading">
              <span className="icon-box"><FileText aria-hidden="true" /></span>
              <span className="data-label">INVOICE</span>
              <span className="status-chip neutral">Sent</span>
            </div>
            <p className="panel-title">INV-000184</p>
            <div className="invoice-person">
              <span>AB</span>
              <div><strong>Adebayo Studio</strong><small>Due 30 July 2026</small></div>
            </div>
            <div className="amount-line"><span>Balance due</span><strong>₦78,400</strong></div>
          </m.article>

          <m.article className="trail-panel checkout-panel" key={`checkout-${motionReady ? "motion" : "static"}`} {...enter(0.2, 0, 16)}>
            <div className="panel-heading">
              <span className="icon-box"><CreditCard aria-hidden="true" /></span>
              <span className="data-label">CHECKOUT</span>
            </div>
            <p className="panel-title">Paystack payment</p>
            <div className="checkout-amount">₦42,000</div>
            <div className="checkout-control"><span>Pay securely</span><ShieldCheck aria-hidden="true" /></div>
          </m.article>

          <m.article className="trail-panel reference-panel" key={`reference-${motionReady ? "motion" : "static"}`} {...enter(0.32, 0, -14)}>
            <div className="reference-state"><span className="pulse-dot" /><span>Provider verified</span></div>
            <p className="data-label">PAYSTACK REFERENCE</p>
            <p className="reference-code">T8129-4F3A-90LX</p>
            <div className="provider-check"><CheckCircle2 aria-hidden="true" /><span>Amount and status confirmed server-side</span></div>
          </m.article>

          <m.article className="trail-panel match-panel" key={`match-${motionReady ? "motion" : "static"}`} {...enter(0.44, 0, 12)}>
            <div className="match-mark"><CheckCircle2 aria-hidden="true" /></div>
            <div><span className="data-label">RECONCILIATION</span><p>Payment matched</p></div>
            <span className="status-chip success">Verified</span>
          </m.article>

          <m.article className="trail-panel payout-panel" key={`payout-${motionReady ? "motion" : "static"}`} {...enter(0.56, -14, 8)}>
            <div className="panel-heading">
              <span className="icon-box"><Landmark aria-hidden="true" /></span>
              <span className="data-label">PAYOUT ROUTE</span>
              <span className="status-chip success">Active</span>
            </div>
            <p className="panel-title">Business settlement</p>
            <p className="muted-line">Account ending in 4821</p>
          </m.article>

          <m.article className="trail-panel receipt-panel" key={`receipt-${motionReady ? "motion" : "static"}`} {...enter(0.68, 18, 0)}>
            <div className="panel-heading">
              <span className="icon-box"><ReceiptText aria-hidden="true" /></span>
              <span className="data-label">RECEIPT</span>
              <span className="status-chip success">Issued</span>
            </div>
            <p className="panel-title">RCT-000241</p>
            <div className="receipt-total"><span>Payment received</span><strong>₦42,000</strong></div>
            <p className="muted-line">Public receipt link ready</p>
          </m.article>
        </div>

        <div className="trail-window-footer">
          <span><span className="pulse-dot" /> Financial trail connected</span>
          <span>Invoice balance now ₦36,400</span>
        </div>
      </div>
    </LazyMotion>
  );
}
