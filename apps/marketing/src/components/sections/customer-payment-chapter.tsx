"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

import { NairaText } from "@/components/ui/naira-text";
import { customerPaymentSection, marketingDemo } from "@/content/site-copy";

export function CustomerPaymentChapter() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.2 }
    );
    el.querySelectorAll(".reveal").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="customer-payment-title" className="payment-section" id="customer-payment" ref={ref}>
      <div className="shell-container payment-grid">
        <div className="payment-copy reveal">
          <p className="section-eyebrow">{customerPaymentSection.eyebrow}</p>
          <h2 id="customer-payment-title">{customerPaymentSection.heading}</h2>
          <p>{customerPaymentSection.body}</p>
          <p style={{ marginTop: 16, fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
            Paystack handles the payment flow. Lumina only updates state after provider confirmation.
          </p>
        </div>

        <div className="payment-visual reveal" aria-label="Public invoice with payment panel">
          <article className="payment-doc" aria-label={`Public invoice ${marketingDemo.invoiceNumber}`}>
            <div className="payment-doc-head">
              <span className="data-label">Invoice from {marketingDemo.business}</span>
              <strong>{marketingDemo.invoiceNumber}</strong>
              <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>
                {marketingDemo.customer} · Due {marketingDemo.dueDate}
              </p>
            </div>
            <div className="payment-doc-body">
              <div className="mock-line"><span>Brand identity refresh</span><strong><NairaText value="₦48,400" /></strong></div>
              <div className="mock-line"><span>Monthly retainer</span><strong><NairaText value="₦30,000" /></strong></div>
              <div className="payment-due"><span>Amount due</span><strong><NairaText value={marketingDemo.total} /></strong></div>
            </div>
          </article>

          <aside className="payment-panel-card" aria-label="Payment panel">
            <span className="data-label">Payment</span>
            <div className="mock-pay-cta" style={{ marginTop: 12 }}><span>Pay <NairaText value={marketingDemo.total} /> online</span></div>
            <p style={{ margin: "12px 0 0", fontSize: "0.75rem", color: "var(--ink-secondary)", lineHeight: 1.6 }}>
              No Lumina account needed. You will be redirected to Paystack.
            </p>
            <div className="payment-confirmed">
              <CheckCircle2 aria-hidden="true" style={{ width: 16, height: 16, flex: "none", marginTop: 2 }} />
              <span>After Paystack confirms, the invoice shows paid and a receipt is issued.</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
