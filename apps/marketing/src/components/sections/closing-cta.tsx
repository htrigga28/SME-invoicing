"use client";

import { useEffect, useRef } from "react";

import { SignupAnchor } from "@/components/ui/signup-anchor";
import { closingCta } from "@/content/site-copy";
import { getAppLoginUrl } from "@/lib/urls";
import { prefersReducedMotion } from "@/lib/editorial-motion";

export function ClosingCta() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;
    let disposed = false;
    let revert = () => {};
    void import("gsap").then(({ gsap }) => {
      void import("gsap/ScrollTrigger").then(({ ScrollTrigger }) => {
        if (disposed || !el) return;
        gsap.registerPlugin(ScrollTrigger);
        const mm = gsap.matchMedia();
        mm.add("(min-width: 1024px)", () => {
          // Color-field chapter wipe: the deep-green field rises from below
          // while the FAQ rows clear, and the workspace card docks from the
          // lower-right with a slight tilt.
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: "top 95%",
              end: "top 35%",
              scrub: 0.8,
              invalidateOnRefresh: true
            }
          });
          tl.fromTo(el, { yPercent: 12 }, { yPercent: 0, duration: 1, ease: "power2.out" }, 0)
            .fromTo(".closing-card", { xPercent: 45, yPercent: 35, rotation: 4, opacity: 0 }, { xPercent: 0, yPercent: 0, rotation: 0, opacity: 1, duration: 1, ease: "power2.out" }, 0.1)
            .fromTo(".closing-copy-wrap", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, 0);
          return () => {
            tl.scrollTrigger?.kill();
            tl.kill();
          };
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
    <section aria-labelledby="closing-title" className="closing-section editorial-section" id="get-started" ref={ref}>
      <div className="shell-container closing-layout">
        <div className="closing-copy-wrap">
          <p className="closing-eyebrow"><span className="closing-lime-dot" aria-hidden="true" />GET STARTED</p>
          <h2 id="closing-title">{closingCta.heading}</h2>
          <p className="closing-copy">{closingCta.copy}</p>
        </div>
        <div className="closing-card" data-enter="bottom-right">
          <span className="data-label">Your workspace</span>
          <strong>Create your Lumina workspace</strong>
          <p>Business details, invoice defaults, and Paystack payout setup in three short steps.</p>
          <div className="closing-actions">
            <SignupAnchor className="w-full" size="lg">
              {closingCta.primary}
            </SignupAnchor>
            <a className="closing-signin" href={getAppLoginUrl()}>
              {closingCta.secondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
