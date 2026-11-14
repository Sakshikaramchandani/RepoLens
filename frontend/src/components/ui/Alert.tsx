import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "./cn";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-info-soft border-info/20", icon: <Info className="size-4 shrink-0 text-info" aria-hidden="true" /> },
  success: {
    box: "bg-success-soft border-success/20",
    icon: <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />,
  },
  warning: {
    box: "bg-warning-soft border-warning/25",
    icon: <TriangleAlert className="size-4 shrink-0 text-warning" aria-hidden="true" />,
  },
  error: {
    box: "bg-danger-soft border-danger/20",
    icon: <CircleAlert className="size-4 shrink-0 text-danger" aria-hidden="true" />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex animate-fade gap-2.5 rounded-md border px-3 py-2.5 text-[0.8125rem] text-ink",
        tones[tone].box,
        className,
      )}
    >
      <span className="mt-px">{tones[tone].icon}</span>
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
