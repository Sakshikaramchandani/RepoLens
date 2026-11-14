import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-card",
  accent: "bg-accent text-on-accent hover:bg-accent-strong dark:hover:bg-accent-strong shadow-card",
  secondary: "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-2 shadow-card",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110 dark:text-canvas",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[0.8125rem] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-md",
  lg: "h-11 px-5 text-[0.9375rem] gap-2 rounded-lg",
};

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

/** Presses on pointer-down (scale 0.97), never animates its layout. */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "rl-press inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children !== undefined && children !== null ? <span>{children}</span> : null}
      {rightIcon}
    </button>
  );
}

interface IconButtonProps extends ComponentProps<"button"> {
  label: string;
  size?: "sm" | "md";
  tone?: "default" | "danger";
}

/** Square icon-only button; the label is required (screen readers + tooltip). */
export function IconButton({
  label,
  size = "md",
  tone = "default",
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "rl-press inline-grid shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger" && "hover:bg-danger-soft hover:text-danger",
        size === "sm" ? "size-7" : "size-9",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
