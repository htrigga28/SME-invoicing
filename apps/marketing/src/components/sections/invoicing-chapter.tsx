"use client";

import { useEffect, useRef } from "react";
import { Check, Plus } from "lucide-react";

import { NairaText } from "@/components/ui/naira-text";
import { invoicingChapter, marketingDemo } from "@/content/site-copy";
import { enterVars, exitVars, prefersReducedMotion } from "@/lib/editorial-motion";

export function InvoicingChapter() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
      return;
    }
    let disposed = false;
    let revert = () => {};
    void import("gsap").then(({ gsap }) => {
      void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
        if (disposed || !el) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        mm.add("(min-width: 1024px)", () => {
          // Editor enters from the left edge, preview from the right edge with
          // opposing rotation; both hold readable, then peel outward as the
          // reconciliation chapter begins entering (handoff).
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "bottom 35%",
              scrub: 0.8,
              invalidateOnRefresh: true
            }
          });
          tl.fromTo(".invoicing-editor", enterVars("left"), { xPercent: 0, yPercent: 0, rotation: -2, opacity: 1, duration: 0.5, ease: "power2.out" }, 0)
            .fromTo(".invoicing-preview", enterVars("right"), { xPercent: 0, yPercent: 0, rotation: 2, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.06)
            .fromTo(".invoicing-intro", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0)
            .to(".invoicing-editor", { ...exitVars("left", 60), duration: 0.8, ease: "power2.in" }, 2.9)
            .to(".invoicing-preview", { ...exitVars("right", 60), duration: 0.8, ease: "power2.in" }, 2.97);
          return () => {
            tl.scrollTrigger?.kill();
            tl.kill();
          };
        });
        mm.add("(max-width: 1023px)", () => {
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
        });
        revert = () => mm.revert();
      }).catch(() => undefined);
    }).catch(() => undefined);
    return () => {
      disposed = true;
      revert();
    };
  }, []);

  return (
    <section aria-labelledby="invoicing-title" className="invoicing-section editorial-section" id="invoicing" ref={ref}>
      <div className="shell-container">
        <div className="invoicing-intro reveal">
          <p className="section-eyebrow">{invoicingChapter.eyebrow}</p>
          <h2 id="invoicing-title">{invoicingChapter.heading}</h2>
          <p>{invoicingChapter.body}</p>
        </div>

        <div className="invoicing-split editorial-stage">
          <div aria-label="Invoice editor" className="invoicing-editor" data-enter="left">
            <div className="invoicing-editor-head"><strong>Editor</strong><span className="status-chip neutral">Draft</span></div>
            <div className="mock-field"><span>Customer</span><strong>{marketingDemo.customer}</strong><em>Northstar Projects Ltd</em></div>
            <div className="mock-field"><span>Catalogue</span><strong><Check aria-hidden="true" style={{ width: 14, height: 14, color: "var(--success)" }} /> Brand identity refresh added</strong><em>Reusable product · <NairaText value="₦48,400" /></em></div>
            <div className="mock-field"><span>Line items</span><strong>2 items · Qty 1 each</strong><em><Plus aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: -2 }} /> Add item on the fly</em></div>
            <div className="mock-field"><span>Payment terms</span><strong>Net 14</strong><em>Customer ref {marketingDemo.customerReference}</em></div>
            <p className="invoicing-hint">Set terms, reference, and memo once. The preview on the right is what the customer opens.</p>
          </div>

          <article aria-label={`Customer preview ${marketingDemo.invoiceNumber}`} className="invoicing-preview" data-enter="right">
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
