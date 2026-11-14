import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rl-skeleton", className)} aria-hidden="true" />;
}
