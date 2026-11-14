import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * Radio group with a sliding thumb. The thumb transitions transform/width (CSS, interruptible),
 * so rapid clicks retarget smoothly instead of restarting.
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<Segment<T>>;
  onChange: (value: T) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (el) setThumb({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, options]);

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      className={cn("relative inline-flex rounded-lg border border-line bg-surface-2 p-0.5", className)}
      onKeyDown={(event) => {
        const index = options.findIndex((o) => o.value === value);
        const delta =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? 1
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? -1
              : 0;
        if (!delta) return;
        event.preventDefault();
        const next = options[(index + delta + options.length) % options.length];
        onChange(next.value);
        listRef.current?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
      }}
    >
      {thumb ? (
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 left-0 rounded-md bg-surface shadow-card ring-1 ring-line transition-[transform,width] duration-[260ms] ease-[var(--ease-out)]"
          style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-value={option.value}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-medium transition-colors",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
