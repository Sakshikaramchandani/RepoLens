import { useEffect, useRef, useState } from "react";
import { gsap, prefersReducedMotion } from "./gsap";

/** Animates 0 → value once when value first becomes known (dashboard stats). */
export function useCountUp(value: number | null, duration = 0.9): number | null {
  const [shown, setShown] = useState<number | null>(value === null ? null : 0);
  const done = useRef(false);

  useEffect(() => {
    if (value === null) return;
    if (done.current || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    done.current = true;
    const counter = { n: 0 };
    const tween = gsap.to(counter, {
      n: value,
      duration,
      ease: "expo.out",
      onUpdate: () => setShown(Math.round(counter.n)),
    });
    return () => {
      tween.kill();
    };
  }, [value, duration]);

  return shown;
}
