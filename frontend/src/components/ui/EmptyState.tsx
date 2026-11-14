import type { ReactNode } from "react";
import { cn } from "./cn";

/** Empty state = a next step, never a dead end. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-lg border border-line bg-surface text-muted shadow-card">
        {icon}
      </span>
      <h2 className="mt-4 text-[0.9375rem] font-semibold">{title}</h2>
      {body ? <p className="mt-1 max-w-sm text-[0.8125rem] text-muted">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
