import { Link } from "react-router-dom";
import { cn } from "./ui/cn";

/** The mark: an aperture with a focus point — the "lens" that reads your repo. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <circle cx="16" cy="16" r="8.5" fill="none" strokeWidth="2.5" className="stroke-on-primary" />
      <circle cx="19" cy="13" r="2.6" className="fill-accent" />
    </svg>
  );
}

export function Logo({
  className,
  compact,
  to = "/dashboard",
}: {
  className?: string;
  compact?: boolean;
  to?: string;
}) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2.5 rounded-md", className)} aria-label="RepoLens">
      <LogoMark />
      {compact ? null : <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">RepoLens</span>}
    </Link>
  );
}
