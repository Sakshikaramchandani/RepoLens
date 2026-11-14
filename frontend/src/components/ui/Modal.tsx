import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "./cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** md = confirm dialogs, lg = forms */
  size?: "md" | "lg";
  /** false = Escape and backdrop click do nothing (e.g. while uploading) */
  dismissible?: boolean;
  bodyClassName?: string;
}

/**
 * Native <dialog>: focus is trapped, Escape closes, focus returns to the trigger.
 * Enters with scale 0.97 → 1 + fade (200ms ease-out) from the centre — modals stay centred.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  size = "md",
  dismissible = true,
  bodyClassName = "mt-3 text-sm text-ink-2",
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault();
      }}
      onClick={(event) => {
        if (dismissible && event.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl border-0 bg-surface p-0 text-ink shadow-float open:animate-pop",
        size === "lg" ? "max-w-lg" : "max-w-md",
      )}
    >
      {open ? (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-[0.8125rem] text-muted">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rl-press -mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {children ? <div className={bodyClassName}>{children}</div> : null}
          {actions ? <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
