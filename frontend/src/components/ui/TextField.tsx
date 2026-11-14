import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "./cn";

export interface TextFieldProps extends ComponentProps<"input"> {
  label: string;
  error?: string;
  hint?: string;
  /** Element shown inside the input on the right (e.g. show-password button). */
  endAdornment?: ReactNode;
  /** Element shown inside the input on the left (e.g. a search icon). */
  startAdornment?: ReactNode;
  hideLabel?: boolean;
  /** sm = compact (sidebars, filters), md = forms */
  inputSize?: "sm" | "md";
}

export const fieldClass =
  "w-full rounded-md border bg-surface text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] duration-150 " +
  "focus:border-accent focus:ring-3 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60";

/** Labelled input with accessible hint + error wiring. Works with react-hook-form's register(). */
export function TextField({
  label,
  error,
  hint,
  endAdornment,
  startAdornment,
  hideLabel,
  inputSize = "md",
  id,
  className,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={cn("text-[0.8125rem] font-medium text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="relative">
        {startAdornment ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 flex items-center text-faint",
              inputSize === "sm" ? "left-2.5" : "left-3",
            )}
          >
            {startAdornment}
          </div>
        ) : null}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            fieldClass,
            inputSize === "sm" ? "h-8 px-2.5 text-[0.8125rem]" : "h-10 px-3 text-sm",
            error
              ? "border-danger focus:border-danger focus:ring-danger/15"
              : "border-line-strong hover:border-faint/60",
            endAdornment ? "pr-11" : undefined,
            startAdornment ? (inputSize === "sm" ? "pl-8" : "pl-9") : undefined,
            className,
          )}
          {...rest}
        />
        {endAdornment ? <div className="absolute inset-y-0 right-1 flex items-center">{endAdornment}</div> : null}
      </div>
      {error ? (
        <p id={errorId} className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
