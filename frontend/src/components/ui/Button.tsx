import * as React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base =
  "inline-flex items-center justify-center gap-1.5 font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-0 " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "rounded-[var(--radius-md)] border";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent)] text-white border-[var(--accent)] hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)]",
  secondary:
    "bg-[var(--surface)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface-subtle)] hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] border-transparent hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]",
  danger:
    "bg-[var(--critical)] text-white border-[var(--critical)] hover:bg-[#b91c1c] hover:border-[#b91c1c]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-[13px]",
  icon: "h-8 w-8 p-0 text-[var(--text-secondary)]",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
