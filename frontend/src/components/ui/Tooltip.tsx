import * as React from "react";

interface TooltipProps {
  content: string;
  children: React.ReactElement;
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = React.useState(false);
  const id = React.useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {React.cloneElement(children as React.ReactElement<{ "aria-describedby": string }>, {
        "aria-describedby": id,
      })}
      {visible && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--text-primary)] px-2 py-1 text-[11px] font-medium leading-none text-white shadow-[var(--shadow-md)]"
        >
          {content}
        </span>
      )}
    </span>
  );
}
