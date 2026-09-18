"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

import { NairaText } from "@/components/ui/naira-text";
import { customerPaymentSection, marketingDemo } from "@/content/site-copy";
import { enterVars, exitVars, prefersReducedMotion } from "@/lib/editorial-motion";

export function CustomerPaymentChapter() {
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
          // Public invoice paper slides from the left with a paper tilt while
          // the payment panel docks from the right; confirmation tag crosses
          // diagonally. The pair exits upward as trust takes over.
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "bottom 35%",
              scrub: 0.8,
              invalidateOnRefresh: true
            }
          });
          tl.fromTo(".payment-copy", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0)
            .fromTo(".payment-doc", enterVars("left", 65), { xPercent: 0, yPercent: 0, rotation: -2.5, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.05)
            .fromTo(".payment-panel-card", enterVars("right", 65), { xPercent: 0, yPercent: 0, rotation: 2.5, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.1)
            .fromTo(".payment-confirmed", enterVars("bottom-right", 60), { xPercent: 0, yPercent: 0, rotation: 0, opacity: 1, duration: 0.45, ease: "power2.out" }, 0.25)
            .to(".payment-doc", { ...exitVars("left", 55), duration: 0.8, ease: "power2.in" }, 2.9)
            .to(".payment-panel-card", { ...exitVars("right", 55), duration: 0.8, ease: "power2.in" }, 2.95);
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
          const io = new IntersectionObserver(
            (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
            { threshold: 0.2 }
          );
          el.querySelectorAll(".reveal").forEach((n) => io.observe(n));
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
    <section aria-labelledby="customer-payment-title" className="payment-section editorial-section" id="customer-payment" ref={ref}>
      <div className="shell-container payment-grid">
        <div className="payment-copy reveal">
          <p className="section-eyebrow">{customerPaymentSection.eyebrow}</p>
          <h2 id="customer-payment-title">{customerPaymentSection.heading}</h2>
          <p>{customerPaymentSection.body}</p>
          <p style={{ marginTop: 16, fontSize: "0.8125rem", color: "var(--ink-muted)" }}>
            Paystack handles the payment flow. Lumina only updates state after provider confirmation.
          </p>
        </div>

        <div className="payment-visual editorial-stage" aria-label="Public invoice with payment panel">
          <article aria-label={`Public invoice ${marketingDemo.invoiceNumber}`} className="payment-doc" data-enter="left">
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

          <aside aria-label="Payment panel" className="payment-panel-card" data-enter="right">
            <span className="data-label">Payment</span>
            <div className="mock-pay-cta" style={{ marginTop: 12 }}><span>Pay <NairaText value={marketingDemo.total} /> online</span></div>
            <p style={{ margin: "12px 0 0", fontSize: "0.75rem", color: "var(--ink-secondary)", lineHeight: 1.6 }}>
              No Lumina account needed. You will be redirected to Paystack.
            </p>
            <div className="payment-confirmed" data-enter="bottom-right">
              <CheckCircle2 aria-hidden="true" style={{ width: 16, height: 16, flex: "none", marginTop: 2 }} />
              <span>After Paystack confirms, the invoice shows paid and a receipt is issued.</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
