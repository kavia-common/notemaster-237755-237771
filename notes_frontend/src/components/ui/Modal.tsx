"use client";

import React, { useEffect, useId } from "react";
import { cx } from "@/lib/utils";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        className="absolute inset-0 bg-black/40"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div
        className={cx(
          "relative w-full max-w-2xl rounded-lg border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)]",
          "shadow-[6px_6px_0_var(--retro-ink)]"
        )}
      >
        <div className="flex items-center justify-between border-b-2 border-[var(--retro-ink)] px-4 py-3">
          <h2 id={titleId} className="font-extrabold tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md border-2 border-[var(--retro-ink)] px-2 py-1 text-xs font-extrabold shadow-[2px_2px_0_var(--retro-ink)] hover:bg-black/5"
          >
            ESC
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer ? (
          <div className="border-t-2 border-[var(--retro-ink)] px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
