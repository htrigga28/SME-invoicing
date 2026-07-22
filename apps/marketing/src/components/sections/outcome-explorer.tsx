"use client";

import { ArrowUpRight, CheckCircle2, CircleAlert, RotateCcw } from "lucide-react";
import { AnimatePresence, LazyMotion, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import { type KeyboardEvent, useRef, useState } from "react";

import { outcomes } from "@/content/site-copy";
import { cn } from "@/lib/cn";

const loadMotionFeatures = () => import("@/lib/motion-features").then((module) => module.default);

const toneIcons = {
  success: CheckCircle2,
  warning: CircleAlert,
  neutral: RotateCcw
};

export function OutcomeExplorer() {
  const [activeId, setActiveId] = useState(outcomes[0]!.id);
  const directionRef = useRef(1);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduceMotion = useReducedMotion();
  const activeIndex = outcomes.findIndex((item) => item.id === activeId);
  const active = outcomes[activeIndex]!;
  const ActiveIcon = toneIcons[active.tone];

  function selectOutcome(nextIndex: number, moveFocus = false) {
    const normalizedIndex = (nextIndex + outcomes.length) % outcomes.length;
    directionRef.current = normalizedIndex >= activeIndex ? 1 : -1;
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
    <section className="outcome-section" id="outcomes">
      <div className="shell-container outcome-layout">
        <div className="outcome-copy">
          <p className="section-signal">Clarity after checkout</p>
          <h2>See what happened. Know what to do next.</h2>
          <p>
            Lumina reduces payment noise without erasing history. Move between the three outcomes
            that matter to an owner and see how the operational record changes.
          </p>

          <div aria-label="Payment outcomes" className="outcome-tabs" role="tablist">
            {outcomes.map((item, index) => (
              <button
                aria-controls={`outcome-panel-${item.id}`}
                aria-selected={item.id === activeId}
                className={cn("outcome-tab", item.id === activeId && "is-active")}
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

        <LazyMotion features={loadMotionFeatures} strict>
          <div className="outcome-stage">
            <AnimatePresence initial={false} mode="wait">
              <m.article
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                aria-labelledby={`outcome-tab-${active.id}`}
                className="outcome-panel"
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: directionRef.current * -22, filter: "blur(8px)" }}
                id={`outcome-panel-${active.id}`}
                initial={reduceMotion ? false : { opacity: 0, x: directionRef.current * 22, filter: "blur(8px)" }}
                key={active.id}
                role="tabpanel"
                transition={reduceMotion ? { duration: 0.01 } : { duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
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
                  <strong>{active.amount}</strong>
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
                    <div key={event.label}><dt>{event.label}</dt><dd>{event.value}</dd></div>
                  ))}
                </dl>

                <div className="outcome-next">
                  <span>Next clear state</span>
                  <strong>{active.nextAction}</strong>
                </div>
              </m.article>
            </AnimatePresence>
          </div>
        </LazyMotion>
      </div>
    </section>
  );
}
