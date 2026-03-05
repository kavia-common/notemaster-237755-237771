"use client";

import React from "react";
import { cx } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(
        "w-full rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] px-3 py-2 text-sm " +
          "shadow-[2px_2px_0_var(--retro-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--retro-blue)]",
        className
      )}
      {...props}
    />
  );
});

export const TextArea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function TextArea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(
        "w-full rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] px-3 py-2 text-sm " +
          "shadow-[2px_2px_0_var(--retro-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--retro-cyan)]",
        className
      )}
      {...props}
    />
  );
});

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cx(
        "block text-xs font-extrabold uppercase tracking-wider text-[var(--retro-ink)]",
        className
      )}
      {...props}
    />
  );
}

export function HelperText({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cx("text-xs text-[var(--retro-ink-2)]", className)}
      {...props}
    />
  );
}
