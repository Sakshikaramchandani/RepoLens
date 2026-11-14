import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/** The one panel style: surface, hairline border, no heavy shadow. */
export function Card({ className, ...rest }: ComponentProps<"section">) {
  return <section className={cn("rounded-lg border border-line bg-surface p-5 shadow-card", className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  action,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className="text-[0.9375rem] font-semibold">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-[0.8125rem] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
