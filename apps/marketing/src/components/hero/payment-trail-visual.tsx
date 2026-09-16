"use client";

import {
  CheckCircle2,
  CreditCard,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { NairaText } from "@/components/ui/naira-text";
import { hero } from "@/content/site-copy";

export function PaymentTrailVisual() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion || !rootRef.current) return;
    const root = rootRef.current;

    let disposed = false;
    let revert = () => {};
    void import("gsap").then(({ gsap }) => {
      if (disposed) return;
      const context = gsap.context(() => {
        gsap.fromTo(
          root.querySelectorAll(".trail-panel"),
          { opacity: 0.45, y: 14, filter: "blur(6px)" },
          { duration: 0.46, stagger: 0.08, opacity: 1, y: 0, filter: "blur(0px)", ease: "power2.out" }
        );
        gsap.fromTo(
          root.querySelectorAll(".trail-route"),
          { scaleX: 0 },
          { duration: 0.8, delay: 0.2, scaleX: 1, ease: "power2.out" }
        );
      }, root);
      revert = () => context.revert();
    }).catch(() => undefined);

    return () => {
      disposed = true;
      revert();
    };
  }, [reduceMotion]);

  return (
      <div className="trail-window" aria-label="Illustrative connected payment trail" ref={rootRef}>
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
          <div
            aria-hidden="true"
            className="trail-route trail-route-main"
          />
          <div
            aria-hidden="true"
            className="trail-route trail-route-branch"
          />

          <article className="trail-panel invoice-panel">
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
            <div className="amount-line"><span>Balance due</span><strong><NairaText value="₦78,400" /></strong></div>
          </article>

          <article className="trail-panel checkout-panel">
            <div className="panel-heading">
              <span className="icon-box"><CreditCard aria-hidden="true" /></span>
              <span className="data-label">CHECKOUT</span>
            </div>
            <p className="panel-title">Paystack payment</p>
            <div className="checkout-amount"><NairaText value="₦42,000" /></div>
            <div className="checkout-control"><span>Pay securely</span><ShieldCheck aria-hidden="true" /></div>
          </article>

          <article className="trail-panel reference-panel">
            <div className="reference-state"><span className="pulse-dot" /><span>Provider verified</span></div>
            <p className="data-label">PAYSTACK REFERENCE</p>
            <p className="reference-code">T8129-4F3A-90LX</p>
            <div className="provider-check"><CheckCircle2 aria-hidden="true" /><span>Amount and status confirmed server-side</span></div>
          </article>

          <article className="trail-panel match-panel">
            <div className="match-mark"><CheckCircle2 aria-hidden="true" /></div>
            <div><span className="data-label">RECONCILIATION</span><p>Payment matched</p></div>
            <span className="status-chip success">Verified</span>
          </article>

          <article className="trail-panel payout-panel">
            <div className="panel-heading">
              <span className="icon-box"><Landmark aria-hidden="true" /></span>
              <span className="data-label">PAYOUT ROUTE</span>
              <span className="status-chip success">Active</span>
            </div>
            <p className="panel-title">Business payout</p>
            <p className="muted-line">Account ending in 4821</p>
          </article>

          <article className="trail-panel receipt-panel">
            <div className="panel-heading">
              <span className="icon-box"><ReceiptText aria-hidden="true" /></span>
              <span className="data-label">RECEIPT</span>
              <span className="status-chip success">Issued</span>
            </div>
            <p className="panel-title">RCT-000241</p>
            <div className="receipt-total"><span>Payment received</span><strong><NairaText value="₦42,000" /></strong></div>
            <p className="muted-line">Public receipt link ready</p>
          </article>
        </div>

        <div className="trail-window-footer">
          <span><span className="pulse-dot" /> Financial trail connected</span>
          <span><NairaText value="Invoice balance now ₦36,400" /></span>
        </div>
      </div>
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
