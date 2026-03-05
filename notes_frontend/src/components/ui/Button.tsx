"use client";

import React from "react";
import { cx } from "@/lib/utils";

type ButtonVariant = "primary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold " +
    "transition active:translate-y-[1px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";
  const styles: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--retro-ink)] text-[var(--retro-paper)] border-2 border-[var(--retro-ink)] shadow-[2px_2px_0_var(--retro-ink)] " +
      "hover:bg-[var(--retro-ink-2)] focus-visible:ring-[var(--retro-cyan)] focus-visible:ring-offset-[var(--retro-paper)]",
    ghost:
      "bg-transparent text-[var(--retro-ink)] border-2 border-[var(--retro-ink)] shadow-[2px_2px_0_var(--retro-ink)] " +
      "hover:bg-[color-mix(in_srgb,var(--retro-ink)_8%,transparent)] focus-visible:ring-[var(--retro-blue)] focus-visible:ring-offset-[var(--retro-paper)]",
    danger:
      "bg-[var(--retro-red)] text-[var(--retro-paper)] border-2 border-[var(--retro-ink)] shadow-[2px_2px_0_var(--retro-ink)] " +
      "hover:opacity-90 focus-visible:ring-[var(--retro-red)] focus-visible:ring-offset-[var(--retro-paper)]",
  };

  return (
    <button
      className={cx(base, styles[variant], "disabled:opacity-50", className)}
      {...props}
    />
  );
}
