"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { NairaText } from "@/components/ui/naira-text";
import { hero, marketingDemo } from "@/content/site-copy";

export function InvoiceHeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let disposed = false;
    let revert = () => {};
    void import("gsap").then(({ gsap }) => {
      if (disposed || !root) return;
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.fromTo(
          ".hero-invoice-paper",
          { opacity: 0, y: 22 },
          { opacity: 1, y: 0, duration: 0.6 }
        )
          .fromTo(
            ".hero-layer-back",
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.5 },
            "-=0.38"
          )
          .fromTo(
            ".hero-layer-side",
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.5 },
            "-=0.34"
          )
          .fromTo(
            ".hero-copy > *",
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.5, stagger: 0.07 },
            0
          );
      }, root);
      revert = () => ctx.revert();
    }).catch(() => undefined);
    return () => {
      disposed = true;
      revert();
    };
  }, []);

  return (
    <div
      aria-label="Illustrative Lumina invoice with matched payment state"
      className="invoice-hero-scene"
      ref={rootRef}
    >
      <div aria-hidden="true" className="hero-layer-back">
        <div className="hero-mini-head">
          <strong>New invoice</strong>
          <span className="status-chip neutral">Draft</span>
        </div>
        <div className="hero-mini-body">
          <div className="hero-mini-metric"><span>Customer</span><strong>{marketingDemo.customer}</strong></div>
          <div className="hero-mini-metric"><span>Catalogue</span><strong>2 items added</strong></div>
          <div className="hero-mini-metric"><span>Payment terms</span><strong>Net 14</strong></div>
        </div>
      </div>

      <article className="hero-invoice-paper" aria-label={`Invoice ${marketingDemo.invoiceNumber}`}>
        <div className="hero-paper-head">
          <span className="data-label">{marketingDemo.business}</span>
          <strong>{marketingDemo.invoiceNumber}</strong>
          <div className="hero-paper-meta">
            <span>Bill to {marketingDemo.customer}</span>
            <span className="mono">Due {marketingDemo.dueDate}</span>
          </div>
        </div>
        <div className="hero-paper-body">
          <div className="hero-paper-row"><span>Brand identity refresh</span><strong><NairaText value="₦48,400" /></strong></div>
          <div className="hero-paper-row"><span>Monthly retainer · design support</span><strong><NairaText value="₦30,000" /></strong></div>
          <div className="hero-paper-total"><span>Total due</span><strong><NairaText value={marketingDemo.total} /></strong></div>
          <div style={{ marginTop: 12 }}>
            <span className="hero-paid-pill"><i />Matched · <NairaText value="₦0 due" /></span>
          </div>
        </div>
      </article>

      <div aria-hidden="true" className="hero-layer-side">
        <div className="hero-mini-head">
          <strong>Payment confirmed</strong>
          <CheckCircle2 aria-hidden="true" color="#237A57" size={16} />
        </div>
        <div className="hero-mini-body">
          <div className="hero-mini-metric"><span>Reference</span><strong className="mono" style={{ fontFamily: "var(--font-jetbrains)", fontSize: "0.7rem" }}>{marketingDemo.providerReference}</strong></div>
          <div className="hero-mini-metric"><span>Receipt</span><strong className="mono" style={{ fontFamily: "var(--font-jetbrains)", fontSize: "0.7rem" }}>{marketingDemo.receiptNumber}</strong></div>
          <p style={{ margin: 0, fontSize: "0.6875rem", color: "var(--ink-muted)" }}>{hero.demoLabel}</p>
        </div>
      </div>
    </div>
  );
}
