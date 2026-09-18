"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import { NairaText } from "@/components/ui/naira-text";
import { visibilitySection } from "@/content/site-copy";
import { enterVars, exitVars, prefersReducedMotion, runEditorialMotion } from "@/lib/editorial-motion";

export function ReceivablesVisibility() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = el.querySelectorAll(".visibility-bars span");
    const settleBars = () => bars.forEach((b) => b instanceof HTMLElement && (b.style.transform = "scaleY(1)"));
    if (prefersReducedMotion()) {
      settleBars();
      el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
      return;
    }
    return runEditorialMotion((gsap, mm) => {
        mm.add("(min-width: 1024px)", () => {
          // Cropped workspace fragments compose from opposing sides: chart
          // panel from the left, activity card from the right with tilt, while
          // metrics rise briefly. All drift out as customer payment enters.
          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "bottom 35%",
              scrub: 0.8,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                for (const [index, bar] of bars.entries()) {
                  if (!(bar instanceof HTMLElement)) continue;
                  const p = Math.min(1, Math.max(0, (self.progress - 0.05 - index * 0.015) * 3.2));
                  bar.style.transform = `scaleY(${0.15 + p * 0.85})`;
                }
              }
            }
          });
          tl.fromTo(".visibility-intro", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0)
            .fromTo(".visibility-chart", enterVars("left", 60), { xPercent: 0, yPercent: 0, rotation: -1.5, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.05)
            .fromTo(".visibility-activity", enterVars("right", 60), { xPercent: 0, yPercent: 0, rotation: 2.5, opacity: 1, duration: 0.5, ease: "power2.out" }, 0.1)
            .fromTo(".visibility-metric", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.04, ease: "power2.out" }, 0.08)
            .to(".visibility-chart", { ...exitVars("left", 55), duration: 0.8, ease: "power2.in" }, 2.9)
            .to(".visibility-activity", { ...exitVars("right", 55), duration: 0.8, ease: "power2.in" }, 2.95);
          return () => {
            tl.scrollTrigger?.kill();
            tl.kill();
          };
        });
        mm.add("(max-width: 1023px)", () => {
          settleBars();
          if (typeof IntersectionObserver === "undefined") {
            el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
            return;
          }
          const rio = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (entry.isIntersecting) entry.target.classList.add("is-visible");
              }
            },
            { threshold: 0.2 }
          );
          el.querySelectorAll(".reveal").forEach((n) => rio.observe(n));
          return () => rio.disconnect();
        });
    });
  }, []);

  return (
    <section aria-labelledby="visibility-title" className="visibility-section editorial-section" id="visibility" ref={ref}>
      <div className="shell-container">
        <div className="visibility-intro reveal">
          <p className="section-eyebrow">{visibilitySection.eyebrow}</p>
          <h2 id="visibility-title">{visibilitySection.heading}</h2>
          <p>{visibilitySection.body}</p>
        </div>

        <div className="visibility-panel" aria-label="Receivables operating view" data-enter="bottom">
          <div className="visibility-metrics">
            {visibilitySection.metrics.map((m) => (
              <div className="visibility-metric" key={m.id}>
                <span>{m.label}</span>
                <strong><NairaText value={m.value} /></strong>
                <small>{m.note}</small>
              </div>
            ))}
          </div>
          <div className="visibility-body editorial-stage">
            <div className="visibility-chart" data-enter="left">
              <span className="data-label">Collections · last 8 weeks</span>
              <h3>Confirmed collections trend</h3>
              <div aria-hidden="true" className="visibility-bars" style={{ transformOrigin: "bottom" }}>
                {[38, 52, 44, 66, 58, 78, 72, 92].map((h, i) => (
                  <span className={i === 7 ? "is-primary" : ""} key={i} style={{ height: `${h}%`, transform: "scaleY(0.15)", transformOrigin: "bottom" }} />
                ))}
              </div>
              <p style={{ margin: "16px 0 0", fontSize: "0.75rem", color: "var(--ink-muted)" }}>Illustrative demo data · successful payments less processed refunds</p>
            </div>
            <div className="visibility-activity" data-enter="right">
              <span className="data-label">{visibilitySection.recentActivity.label}</span>
              <div className="visibility-event" style={{ marginTop: 12 }}>
                <span className="event-icon"><Check aria-hidden="true" /></span>
                <div>
                  <strong style={{ fontSize: "0.8125rem" }}>{visibilitySection.recentActivity.title}</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--ink-secondary)", marginTop: 4 }}><NairaText value={visibilitySection.recentActivity.meta} /></div>
                </div>
              </div>
              <div className="visibility-callouts" style={{ gridTemplateColumns: "1fr", gap: 14, marginTop: 20 }}>
                {visibilitySection.callouts.slice(0, 2).map((c) => (
                  <article key={c.title} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
                    <strong style={{ fontSize: "0.8125rem" }}>{c.title}</strong>
                    <p style={{ fontSize: "0.75rem" }}>{c.copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="visibility-callouts">
          {visibilitySection.callouts.map((c) => (
            <article key={c.title}>
              <strong>{c.title}</strong>
              <p>{c.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
