"use client";

import { ArrowUpRight, CheckCircle2, CircleAlert, RotateCcw } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import { NairaText } from "@/components/ui/naira-text";
import { outcomes, reconciliationSection } from "@/content/site-copy";
import { enterVars, exitVars, loadGsap, prefersReducedMotion } from "@/lib/editorial-motion";
import { cn } from "@/lib/cn";

const toneIcons = {
  success: CheckCircle2,
  warning: CircleAlert,
  neutral: RotateCcw
};

export function OutcomeExplorer() {
  const [activeId, setActiveId] = useState(outcomes[0]!.id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = outcomes.findIndex((item) => item.id === activeId);
  const active = outcomes[activeIndex]!;
  const ActiveIcon = toneIcons[active.tone];
  const panelRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (prefersReducedMotion()) return;
    if (window.matchMedia?.("(max-width: 1023px)").matches) return;
    let disposed = false;
    let revert = () => {};
    void loadGsap().then(({ gsap }) => {
        if (disposed || !sectionRef.current) return;
        // Editorial handoff: copy settles calmly while the payment record
        // crosses in from the right, then both drift out as visibility enters.
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 85%",
            end: "bottom 35%",
            scrub: 0.8,
            invalidateOnRefresh: true
          }
        });
        tl.fromTo(".outcome-copy", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0)
          .fromTo(".outcome-panel", enterVars("right", 60), { xPercent: 0, yPercent: 0, rotation: 1.5, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.05)
          .to(".outcome-panel", { ...exitVars("right", 55), duration: 0.8, ease: "power2.in" }, 2.9)
          .to(".outcome-copy", { opacity: 0.15, yPercent: -10, duration: 0.8, ease: "power2.in" }, 2.95);
        revert = () => {
          tl.scrollTrigger?.kill();
          tl.kill();
        };
    }).catch(() => undefined);
    return () => {
      disposed = true;
      revert();
    };
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (prefersReducedMotion()) return;
    let disposed = false;
    let revert = () => {};
    void import("gsap").then(({ gsap }) => {
      if (disposed || !panel) return;
      const ctx = gsap.context(() => {
        gsap.fromTo(panel, { opacity: 0, x: 14 }, { duration: 0.2, opacity: 1, x: 0, ease: "power2.out" });
      }, panel);
      revert = () => ctx.revert();
    }).catch(() => undefined);
    return () => {
      disposed = true;
      revert();
    };
  }, [activeId]);

  function selectOutcome(nextIndex: number, moveFocus = false) {
    const normalizedIndex = (nextIndex + outcomes.length) % outcomes.length;
    setActiveId(outcomes[normalizedIndex]!.id);
    if (moveFocus) tabRefs.current[normalizedIndex]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? outcomes.length - 1
        : index + (event.key === "ArrowRight" ? 1 : -1);
    selectOutcome(nextIndex, true);
  }

  return (
    <section className="outcome-section editorial-section" id="reconciliation" aria-labelledby="reconciliation-title" ref={sectionRef}>
      <div className="shell-container outcome-layout">
        <div className="outcome-copy">
          <p className="section-eyebrow">{reconciliationSection.eyebrow}</p>
          <h2 id="reconciliation-title">{reconciliationSection.heading}</h2>
          <p>{reconciliationSection.support}</p>

          <div aria-label="Payment outcomes" className="outcome-tabs" role="tablist">
            {outcomes.map((item, index) => (
              <button
                aria-controls={`outcome-panel-${item.id}`}
                aria-selected={item.id === activeId}
                className={cn("outcome-tab", item.id === activeId && "is-active")}
                data-tone={item.tone}
                id={`outcome-tab-${item.id}`}
                key={item.id}
                onClick={() => selectOutcome(index)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                ref={(node) => { tabRefs.current[index] = node; }}
                role="tab"
                tabIndex={item.id === activeId ? 0 : -1}
                type="button"
              >
                <span>{item.label}</span>
                <ArrowUpRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div className="outcome-stage">
          <article
            aria-labelledby={`outcome-tab-${active.id}`}
            className="outcome-panel"
            data-enter="right"
            id={`outcome-panel-${active.id}`}
            ref={panelRef}
            role="tabpanel"
          >
            <div className="outcome-panel-top">
              <span className={cn("outcome-status", `tone-${active.tone}`)}>
                <ActiveIcon aria-hidden="true" />
                {active.status}
              </span>
              <span className="demo-label">Illustrative demo data</span>
            </div>

            <div className="outcome-amount">
              <span>{active.amountLabel}</span>
              <strong><NairaText value={active.amount} /></strong>
            </div>

            <div className="outcome-message">
              <span>{active.eyebrow}</span>
              <h3>{active.heading}</h3>
              <p>{active.copy}</p>
            </div>

            <dl className="outcome-events">
              <div><dt>Reference</dt><dd>{active.reference}</dd></div>
              <div><dt>Invoice</dt><dd>{active.invoice}</dd></div>
              {active.events.map((event) => (
                <div key={event.label}><dt>{event.label}</dt><dd><NairaText value={event.value} /></dd></div>
              ))}
            </dl>

            <div className="outcome-next">
              <span>Next clear state</span>
              <strong>{active.nextAction}</strong>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
