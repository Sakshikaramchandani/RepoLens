import { cn } from "./cn";

/** Determinate bar driven by transform (no layout). Indeterminate = sliding segment. */
export function ProgressBar({ value, label, className }: { value: number | null; label: string; className?: string }) {
  const clamped = value === null ? null : Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped ?? undefined}
      className={cn("relative h-1.5 overflow-hidden rounded-full bg-surface-3", className)}
    >
      {clamped === null ? (
        <span className="absolute inset-y-0 w-1/3 animate-[rl-indeterminate_1.2s_var(--ease-in-out)_infinite] rounded-full bg-accent" />
      ) : (
        <span
          className="absolute inset-0 origin-left rounded-full bg-accent transition-transform duration-500 ease-[var(--ease-out)]"
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      )}
    </div>
  );
}
