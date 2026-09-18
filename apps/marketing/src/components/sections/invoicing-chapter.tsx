"use client";

import { useEffect, useRef } from "react";
import { Check, Plus } from "lucide-react";

import { NairaText } from "@/components/ui/naira-text";
import { invoicingChapter, marketingDemo } from "@/content/site-copy";

export function InvoicingChapter() {
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
    const nodes = el.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.2 }
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  return (
    <section aria-labelledby="invoicing-title" className="invoicing-section" id="invoicing" ref={ref}>
      <div className="shell-container">
        <div className="invoicing-intro reveal">
          <p className="section-eyebrow">{invoicingChapter.eyebrow}</p>
          <h2 id="invoicing-title">{invoicingChapter.heading}</h2>
          <p>{invoicingChapter.body}</p>
        </div>

        <div className="invoicing-split">
          <div className="invoicing-editor reveal" aria-label="Invoice editor">
            <div className="invoicing-editor-head"><strong>Editor</strong><span className="status-chip neutral">Draft</span></div>
            <div className="mock-field"><span>Customer</span><strong>{marketingDemo.customer}</strong><em>Northstar Projects Ltd</em></div>
            <div className="mock-field"><span>Catalogue</span><strong><Check aria-hidden="true" style={{ width: 14, height: 14, color: "var(--success)" }} /> Brand identity refresh added</strong><em>Reusable product · <NairaText value="₦48,400" /></em></div>
            <div className="mock-field"><span>Line items</span><strong>2 items · Qty 1 each</strong><em><Plus aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Add item on the fly</em></div>
            <div className="mock-field"><span>Payment terms</span><strong>Net 14</strong><em>Customer ref {marketingDemo.customerReference}</em></div>
            <p className="invoicing-hint">Set terms, reference, and memo once. The preview on the right is what the customer opens.</p>
          </div>

          <article aria-label={`Customer preview ${marketingDemo.invoiceNumber}`} className="invoicing-preview reveal">
            <div className="invoicing-preview-head"><strong>Customer preview</strong><span className="demo-label">Live</span></div>
            <div className="mock-paper-head">
              <span className="data-label">{marketingDemo.business}</span>
              <strong>{marketingDemo.invoiceNumber}</strong>
              <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>Bill to {marketingDemo.customer} · Due {marketingDemo.dueDate}</p>
            </div>
            <div className="mock-paper-body">
              <div className="mock-line"><span>Brand identity refresh</span><strong><NairaText value="₦48,400" /></strong></div>
              <div className="mock-line"><span>Monthly retainer · design support</span><strong><NairaText value="₦30,000" /></strong></div>
              <div className="mock-line"><span>Customer reference</span><strong style={{ fontFamily: "var(--font-jetbrains)", fontSize: "0.75rem" }}>{marketingDemo.customerReference}</strong></div>
              <div className="mock-total"><span>Total</span><strong><NairaText value={marketingDemo.total} /></strong></div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
