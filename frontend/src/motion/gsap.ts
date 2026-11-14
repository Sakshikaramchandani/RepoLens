import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

/**
 * One place that registers GSAP plugins and the house motion values.
 * UI motion: strong ease-out, short. Matches --ease-out in styles/index.css.
 */
gsap.registerPlugin(useGSAP, SplitText);

export const EASE_OUT = "expo.out";
export const EASE_IN_OUT = "power3.inOut";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export { gsap, useGSAP, SplitText };
