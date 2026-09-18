"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import { NairaText } from "@/components/ui/naira-text";
import { visibilitySection } from "@/content/site-copy";

export function ReceivablesVisibility() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = el.querySelectorAll(".visibility-bars span");
    const reveal = () => {
      el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
      bars.forEach((b, i) => {
        if (b instanceof HTMLElement) {
          b.style.transition = "transform 700ms cubic-bezier(0.22,1,0.36,1)";
          b.style.transitionDelay = `${i * 60}ms`;
          b.style.transform = "scaleY(1)";
        }
      });
    };
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      bars.forEach((b) => b instanceof HTMLElement && (b.style.transform = "scaleY(1)"));
      el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      bars.forEach((b) => b instanceof HTMLElement && (b.style.transform = "scaleY(1)"));
      el.querySelectorAll(".reveal").forEach((n) => n.classList.add("is-visible"));
      return;
    }
    bars.forEach((b) => b instanceof HTMLElement && (b.style.transform = "scaleY(0.15)"));
    (bars[0] as HTMLElement | undefined)?.style.setProperty("transform-origin", "bottom");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && reveal()),
      { threshold: 0.25 }
    );
    io.observe(el);
    const rio = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("is-visible")),
      { threshold: 0.2 }
    );
    el.querySelectorAll(".reveal").forEach((n) => rio.observe(n));
    return () => {
      io.disconnect();
      rio.disconnect();
    };
  }, []);

  return (
    <section aria-labelledby="visibility-title" className="visibility-section" id="visibility" ref={ref}>
      <div className="shell-container">
        <div className="visibility-intro reveal">
          <p className="section-eyebrow">{visibilitySection.eyebrow}</p>
          <h2 id="visibility-title">{visibilitySection.heading}</h2>
          <p>{visibilitySection.body}</p>
        </div>

        <div className="visibility-panel reveal" aria-label="Receivables operating view">
          <div className="visibility-metrics">
            {visibilitySection.metrics.map((m) => (
              <div className="visibility-metric" key={m.id}>
                <span>{m.label}</span>
                <strong><NairaText value={m.value} /></strong>
                <small>{m.note}</small>
              </div>
            ))}
          </div>
          <div className="visibility-body">
            <div className="visibility-chart">
              <span className="data-label">Collections · last 8 weeks</span>
              <h3>Confirmed collections trend</h3>
              <div aria-hidden="true" className="visibility-bars" style={{ transformOrigin: "bottom" }}>
                {[38, 52, 44, 66, 58, 78, 72, 92].map((h, i) => (
                  <span className={i === 7 ? "is-primary" : ""} key={i} style={{ height: `${h}%`, transformOrigin: "bottom" }} />
                ))}
              </div>
              <p style={{ margin: "16px 0 0", fontSize: "0.75rem", color: "var(--ink-muted)" }}>Illustrative demo data · successful payments less processed refunds</p>
            </div>
            <div className="visibility-activity">
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

        <div className="visibility-callouts reveal">
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
