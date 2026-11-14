import { useLayoutEffect, useState, type RefObject } from "react";

export interface IndicatorBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Measures the active child (`[data-active="true"]`) of a container so a single indicator can
 * slide between items. CSS transitions on the indicator keep it interruptible: a rapid second
 * click retargets from wherever the pill currently is.
 */
export function useSlidingIndicator(container: RefObject<HTMLElement | null>, deps: ReadonlyArray<unknown>) {
  const [box, setBox] = useState<IndicatorBox | null>(null);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>('[data-active="true"]');
      setBox(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return box;
}
