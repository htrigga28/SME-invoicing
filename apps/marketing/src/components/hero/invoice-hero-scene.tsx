"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { NairaText } from "@/components/ui/naira-text";
import { hero, marketingDemo } from "@/content/site-copy";
import { enterVars, prefersReducedMotion, runEditorialMotion } from "@/lib/editorial-motion";

export function InvoiceHeroScene() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (prefersReducedMotion()) return;
    return runEditorialMotion((gsap, mm) => {
        // Desktop / large tablet: full Acctual-style collage choreography.
        mm.add("(min-width: 768px)", () => {
          const heroCopy = root.closest(".hero-grid")?.querySelector(".hero-copy");
          const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
          intro
            .fromTo(".hero-copy > *", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.07 }, 0)
            .fromTo(".hero-invoice-paper", enterVars("bottom", 90), { xPercent: 0, yPercent: 0, rotation: -1.5, opacity: 1, duration: 0.9 }, 0.1)
            .fromTo(".hero-layer-back", enterVars("left"), { xPercent: 0, yPercent: 0, rotation: -4, opacity: 1, duration: 1 }, 0.18)
            .fromTo(".hero-layer-side", enterVars("right"), { xPercent: 0, yPercent: 0, rotation: 3.5, opacity: 1, duration: 1 }, 0.26)
            .fromTo(".hero-tag-ref", enterVars("top-right", 90), { xPercent: 0, yPercent: 0, rotation: 5, opacity: 1, duration: 0.9 }, 0.34)
            .fromTo(".hero-tag-receipt", enterVars("bottom-left", 90), { xPercent: 0, yPercent: 0, rotation: -6, opacity: 1, duration: 0.9 }, 0.42);

          // Scroll-linked exit: layers peel away at different speeds while the next
          // section rises (handoff). Paper drifts slowest; peripheral tags fastest.
          const exit = gsap.timeline({
            scrollTrigger: {
              trigger: root.closest(".hero-section"),
              start: "top top",
              end: "bottom top+=120",
              scrub: 0.8,
              invalidateOnRefresh: true
            }
          });
          exit
            .to(".hero-invoice-paper", { yPercent: -14, rotation: -3, ease: "none", duration: 1 }, 0)
            .to(".hero-layer-back", { xPercent: -38, yPercent: -8, rotation: -7, opacity: 0.25, ease: "none", duration: 1 }, 0)
            .to(".hero-layer-side", { xPercent: 42, yPercent: -10, rotation: 7, opacity: 0.25, ease: "none", duration: 1 }, 0)
            .to(".hero-tag-ref", { xPercent: 70, yPercent: -55, rotation: 10, opacity: 0, ease: "none", duration: 1 }, 0)
            .to(".hero-tag-receipt", { xPercent: -70, yPercent: 40, rotation: -10, opacity: 0, ease: "none", duration: 1 }, 0);
          if (heroCopy) {
            exit.to(heroCopy, { yPercent: -8, opacity: 0.35, ease: "none", duration: 1 }, 0);
          }
          return () => {
            intro.kill();
            exit.scrollTrigger?.kill();
            exit.kill();
          };
        });
        // Mobile: calm single rise, no off-canvas travel.
        mm.add("(max-width: 767px)", () => {
          const intro = gsap.timeline({ defaults: { ease: "power2.out" } });
          intro.fromTo(
            root.querySelectorAll(".hero-invoice-paper, .hero-layer-back, .hero-layer-side"),
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.55, stagger: 0.09 }
          );
          return () => {
            intro.kill();
          };
        });
    });
  }, []);

  return (
    <div
      aria-label="Illustrative Lumina invoice with matched payment state"
      className="invoice-hero-scene"
      ref={rootRef}
    >
      <div aria-hidden="true" className="hero-layer-back" data-enter="left">
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

      <article className="hero-invoice-paper" aria-label={`Invoice ${marketingDemo.invoiceNumber}`} data-enter="bottom">
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

      <div aria-hidden="true" className="hero-layer-side" data-enter="right">
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

      <div aria-hidden="true" className="hero-tag hero-tag-ref" data-enter="top-right">
        <span className="data-label">Paystack ref</span>
        <strong className="mono">{marketingDemo.providerReference}</strong>
      </div>

      <div aria-hidden="true" className="hero-tag hero-tag-receipt" data-enter="bottom-left">
        <span className="data-label">Receipt issued</span>
        <strong className="mono">{marketingDemo.receiptNumber}</strong>
      </div>
    </div>
  );
}
