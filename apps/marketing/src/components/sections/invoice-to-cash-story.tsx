"use client";

import { CheckCircle2, Link2, ReceiptText, Send, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { NairaText } from "@/components/ui/naira-text";
import { marketingDemo, storyIntro, storySteps } from "@/content/site-copy";
import type { EnterVector } from "@/lib/editorial-motion";
import { enterVars, exitVars, runEditorialMotion } from "@/lib/editorial-motion";

const STATE_VECTORS: Record<string, { enter: EnterVector; exit: EnterVector; rotation: number }> = {
  create: { enter: "left", exit: "left", rotation: -3 },
  share: { enter: "bottom-right", exit: "top-left", rotation: 2.5 },
  pay: { enter: "right", exit: "right", rotation: 3 },
  verify: { enter: "top-right", exit: "bottom-left", rotation: 4 },
  match: { enter: "bottom-left", exit: "top-right", rotation: -3.5 },
  know: { enter: "bottom", exit: "bottom-right", rotation: -1.5 }
};

function StoryVisual({ step }: Readonly<{ step: string }>) {
  const vector = STATE_VECTORS[step]?.enter ?? "bottom";
  if (step === "create") {
    return (
      <div className="story-state" data-enter={vector} data-story-state="create">
        <div className="mock-editor" aria-label="Invoice editor">
          <div className="mock-editor-bar"><strong>New invoice</strong><span className="status-chip neutral">Draft</span></div>
          <div className="mock-field"><span>Customer</span><strong>{marketingDemo.customer}</strong><em>Northstar Projects Ltd · billing on file</em></div>
          <div className="mock-field"><span>Line items · catalogue</span><strong>Brand identity refresh — ₦48,400</strong><em>Monthly retainer · ₦30,000 · + Add item</em></div>
          <div className="mock-field"><span>Total · live preview</span><strong><NairaText value={marketingDemo.total} /></strong><em>Net 14 · Ref {marketingDemo.customerReference}</em></div>
        </div>
        <div className="mock-note"><CheckCircle2 aria-hidden="true" /><span>Catalogue item reused. Totals update in the customer preview before sending.</span></div>
      </div>
    );
  }
  if (step === "share") {
    return (
      <div className="story-state" data-enter="bottom-right" data-story-state="share">
        <article className="mock-paper" aria-label={`Shared invoice ${marketingDemo.invoiceNumber}`}>
          <div className="mock-paper-head">
            <span className="data-label">{marketingDemo.business} · Shared</span>
            <strong>{marketingDemo.invoiceNumber}</strong>
            <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>Bill to {marketingDemo.customer} · Due {marketingDemo.dueDate}</p>
          </div>
          <div className="mock-paper-body">
            <div className="mock-line"><span>Brand identity refresh</span><strong><NairaText value="₦48,400" /></strong></div>
            <div className="mock-line"><span>Monthly retainer</span><strong><NairaText value="₦30,000" /></strong></div>
            <div className="mock-total"><span>Total due</span><strong><NairaText value={marketingDemo.total} /></strong></div>
          </div>
        </article>
        <div className="mock-note"><Send aria-hidden="true" /><span>Public link ready. No account needed to open the document.</span></div>
      </div>
    );
  }
  if (step === "pay") {
    return (
      <div className="story-state" data-enter="right" data-story-state="pay">
        <article className="mock-paper" aria-label="Customer payment view">
          <div className="mock-paper-head">
            <span className="data-label">Invoice from {marketingDemo.business}</span>
            <strong><NairaText value={marketingDemo.total} /> due</strong>
            <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "var(--ink-secondary)" }}>{marketingDemo.invoiceNumber} · Due {marketingDemo.dueDate}</p>
          </div>
          <div className="mock-paper-body">
            <div className="mock-pay-cta"><span>Pay <NairaText value={marketingDemo.total} /> online</span></div>
            <p style={{ margin: "10px 0 0", fontSize: "0.75rem", color: "var(--ink-muted)" }}>Redirected to Paystack to complete payment.</p>
          </div>
        </article>
        <div className="mock-note"><ShieldCheck aria-hidden="true" /><span>One amount, one button. The payer never sees internal tooling.</span></div>
      </div>
    );
  }
  if (step === "verify") {
    return (
      <div className="story-state" data-enter="top-right" data-story-state="verify">
        <div className="mock-editor">
          <div className="mock-editor-bar"><strong>Payment confirmation</strong><span className="status-chip info">Confirming</span></div>
          <div className="mock-field"><span>Provider reference</span><strong className="mock-ref">{marketingDemo.providerReference}</strong><em>Paystack · successful charge</em></div>
          <div className="mock-field"><span>Amount confirmed</span><strong><NairaText value={marketingDemo.total} /></strong><em>Server-side verification · no optimistic update</em></div>
        </div>
        <div className="mock-note"><ShieldCheck aria-hidden="true" /><span>Lumina waits for provider-confirmed truth before touching the balance.</span></div>
      </div>
    );
  }
  if (step === "match") {
    return (
      <div className="story-state" data-enter="bottom-left" data-story-state="match">
        <div className="mock-editor">
          <div className="mock-editor-bar"><strong>Reconciliation</strong><span className="status-chip success">Matched</span></div>
          <div className="mock-field"><span>Reference resolves to invoice</span><strong><Link2 aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: -2 }} /> {marketingDemo.providerReference} → {marketingDemo.invoiceNumber}</strong><em>Customer {marketingDemo.customer}</em></div>
          <div className="mock-field"><span>Balance</span><strong><NairaText value="₦0 due" /></strong><em>Was {marketingDemo.total} · now settled</em></div>
        </div>
        <div className="mock-note"><CheckCircle2 aria-hidden="true" /><span>No mystery transfer. The payment has a home.</span></div>
      </div>
    );
  }
  return (
    <div className="story-state" data-enter="bottom" data-story-state="know">
      <div className="mock-editor">
        <div className="mock-editor-bar"><strong>Business position</strong><span className="status-chip success">Paid</span></div>
        <div className="mock-field"><span>{marketingDemo.invoiceNumber} · paid</span><strong><NairaText value={marketingDemo.total} /> collected</strong><em>Receipt {marketingDemo.receiptNumber} issued · immutable</em></div>
        <div className="mock-field"><span>Overview updated</span><strong>Outstanding down · Collections up</strong><em>Latest activity: {marketingDemo.providerReference} matched</em></div>
      </div>
      <div className="mock-note"><ReceiptText aria-hidden="true" /><span>Invoice, payment, receipt, and dashboard stay connected.</span></div>
    </div>
  );
}

export function InvoiceToCashStory() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    return runEditorialMotion((gsap, mm) => {
        mm.add("(min-width: 1024px)", () => {
          const states = gsap.utils.toArray<HTMLElement>("[data-story-state]", section);
          const steps = gsap.utils.toArray<HTMLElement>("[data-story-step]", section);
          const progressSegments = gsap.utils.toArray<HTMLElement>("[data-story-progress-segment]", section);
          if (states.length === 0) return;
          const first = states[0];
          if (!first) return;
          const firstCfg = STATE_VECTORS["create"]!;
          gsap.set(states, { autoAlpha: 0 });
          gsap.set(first, { autoAlpha: 1, xPercent: 0, yPercent: 0, rotation: firstCfg.rotation });
          steps.forEach((s, i) => s.classList.toggle("is-active", i === 0));
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section.querySelector(".story-shell"),
              start: "top top+=96",
              end: "+=340%",
              scrub: 0.7,
              pin: section.querySelector(".story-stage"),
              anticipatePin: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                for (const [index, segment] of progressSegments.entries()) {
                  segment.style.setProperty(
                    "--story-progress",
                    String(getStorySegmentProgress(self.progress, index, states.length))
                  );
                }
                const activeIndex = Math.min(
                  states.length - 1,
                  Math.floor(self.progress * states.length)
                );
                for (const [index, step] of steps.entries()) {
                  step.classList.toggle("is-active", index === activeIndex);
                }
              }
            }
          });
          const order = ["create", "share", "pay", "verify", "match", "know"];
          order.forEach((id, i) => {
            if (i === 0) return;
            const prevId = order[i - 1]!;
            const prevCfg = STATE_VECTORS[prevId]!;
            const nextCfg = STATE_VECTORS[id]!;
            const prev = states[i - 1];
            const next = states[i];
            if (!prev || !next) return;
            // Beat shape: quick physical exit, snappy directional entrance,
            // then a readable hold before the next beat takes over.
            const at = i * 1;
            tl.to(prev, { ...exitVars(prevCfg.exit, 75), duration: 0.3, ease: "power2.in" }, at);
            tl.fromTo(
              next,
              { ...enterVars(nextCfg.enter, 70), rotation: nextCfg.rotation * 1.5 },
              { autoAlpha: 1, xPercent: 0, yPercent: 0, rotation: nextCfg.rotation, duration: 0.35, ease: "power2.out" },
              at + 0.28
            );
            tl.to({}, { duration: 0.37 });
          });
          // Release handoff: resolved composition peels diagonally as the pin ends
          // so the invoicing chapter can begin entering underneath it.
          const last = states[states.length - 1];
          if (last) {
            tl.to(last, { xPercent: 60, yPercent: -40, rotation: 5, autoAlpha: 0, duration: 0.5, ease: "power2.in" }, ">");
          } else {
            tl.to({}, { duration: 0.4 });
          }
          return () => {
            tl.scrollTrigger?.kill();
            tl.kill();
          };
        });
    });
  }, []);

  return (
    <section aria-labelledby="how-it-works-title" className="story-section" id="how-it-works" ref={sectionRef}>
      <div className="shell-container">
        <div className="story-intro">
          <div>
            <p className="section-eyebrow">{storyIntro.eyebrow}</p>
            <h2 id="how-it-works-title">{storyIntro.heading}</h2>
          </div>
          <p className="story-intro-copy">{storyIntro.copy}</p>
        </div>

        <div className="story-shell">
          <div className="story-copy-rail">
            {storySteps.map((step) => (
              <article aria-label={`${step.index} ${step.label}`} className="story-step" data-story-step={step.id} key={step.id}>
                <span className="story-step-index">{step.index} · {step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
                <span className="story-step-meta">
                  {marketingDemo.invoiceNumber} · <NairaText value={marketingDemo.total} />
                  {step.id === "verify" || step.id === "match" || step.id === "know" ? ` · ${marketingDemo.providerReference}` : ""}
                  {step.id === "know" ? ` · ${marketingDemo.receiptNumber}` : ""}
                </span>
              </article>
            ))}
          </div>
          <div className="story-stage" aria-label="Invoice lifecycle product stage">
            <div className="story-stage-frame">
              <StoryVisual step="create" />
              <StoryVisual step="share" />
              <StoryVisual step="pay" />
              <StoryVisual step="verify" />
              <StoryVisual step="match" />
              <StoryVisual step="know" />
            </div>
            <div aria-hidden="true" className="story-progress">
              {storySteps.map((step) => <span data-story-progress-segment key={step.id} />)}
            </div>
          </div>
        </div>

        <div className="story-mobile" aria-label="Invoice lifecycle, step by step">
          {storySteps.map((step) => (
            <article aria-label={`${step.index} ${step.label}`} className="story-mobile-step" data-story-step={step.id} key={step.id}>
              <span className="story-step-index">{step.index} · {step.label}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
              <StoryVisual step={step.id} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function getStorySegmentProgress(progress: number, index: number, total: number) {
  return Math.min(1, Math.max(0, progress * total - index));
}
