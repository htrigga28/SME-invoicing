export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export async function loadGsap() {
  const { gsap } = await import("gsap");
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
}

export type EnterVector = "left" | "right" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

export function enterVars(vector: EnterVector, distance = 115) {
  switch (vector) {
    case "left":
      return { xPercent: -distance, yPercent: 8, rotation: -5, opacity: 0 };
    case "right":
      return { xPercent: distance, yPercent: 8, rotation: 4, opacity: 0 };
    case "bottom":
      return { xPercent: 0, yPercent: 60, rotation: -2, opacity: 0 };
    case "top-left":
      return { xPercent: -distance, yPercent: -30, rotation: -6, opacity: 0 };
    case "top-right":
      return { xPercent: distance, yPercent: -30, rotation: 5, opacity: 0 };
    case "bottom-left":
      return { xPercent: -distance, yPercent: 45, rotation: -4, opacity: 0 };
    case "bottom-right":
      return { xPercent: distance, yPercent: 45, rotation: 5, opacity: 0 };
  }
}

export function exitVars(vector: EnterVector, distance = 125) {
  switch (vector) {
    case "left":
      return { xPercent: -distance, yPercent: -10, rotation: -4, opacity: 0 };
    case "right":
      return { xPercent: distance, yPercent: -12, rotation: 4, opacity: 0 };
    case "bottom":
      return { xPercent: 0, yPercent: 55, rotation: 2, opacity: 0 };
    case "top-left":
      return { xPercent: -distance, yPercent: -35, rotation: -5, opacity: 0 };
    case "top-right":
      return { xPercent: distance, yPercent: -35, rotation: 5, opacity: 0 };
    case "bottom-left":
      return { xPercent: -distance, yPercent: 50, rotation: -5, opacity: 0 };
    case "bottom-right":
      return { xPercent: distance, yPercent: 50, rotation: 6, opacity: 0 };
  }
}
