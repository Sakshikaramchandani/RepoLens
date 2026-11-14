import { useRef, type ReactNode } from "react";
import { cn } from "../components/ui/cn";
import { EASE_OUT, gsap, prefersReducedMotion, useGSAP } from "./gsap";

/**
 * Route entrance — one entrance per page, choreographed as lead + support:
 *   [data-enter="lead"]     page title block: 10px rise + fade, 420ms
 *   [data-enter="support"]  everything else marked: 6px rise, starts 60ms later, overlaps
 * Nothing waits for it: content is clickable from the first frame (opacity starts at 0.001 → 1).
 * Reduced motion: a 150ms fade, no movement.
 */
export function PageEnter({ children, className }: { children: ReactNode; className?: string }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const lead = gsap.utils.toArray<HTMLElement>('[data-enter="lead"]');
      const support = gsap.utils.toArray<HTMLElement>('[data-enter="support"]');
      if (prefersReducedMotion()) {
        gsap.from([...lead, ...support], { autoAlpha: 0, duration: 0.15, ease: "none" });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: EASE_OUT } });
      if (lead.length) tl.from(lead, { y: 10, autoAlpha: 0, duration: 0.42 }, 0);
      if (support.length) {
        // shrinking gaps read as a wave, equal gaps as a metronome
        tl.from(
          support,
          {
            y: 6,
            autoAlpha: 0,
            duration: 0.38,
            stagger: { each: 0.05, ease: "power2.in" },
          },
          0.06,
        );
      }
    },
    { scope },
  );

  return (
    <div ref={scope} className={cn(className)}>
      {children}
    </div>
  );
}
