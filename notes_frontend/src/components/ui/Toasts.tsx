"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cx } from "@/lib/utils";

type Toast = {
  id: string;
  kind: "info" | "error" | "success";
  title: string;
  message?: string;
};

type ToastsCtx = {
  push: (t: Omit<Toast, "id">) => void;
};

const Ctx = createContext<ToastsCtx | null>(null);

// PUBLIC_INTERFACE
export function useToasts() {
  /** Access toast notifications. Must be used under <ToastsProvider/>. */
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToasts must be used within ToastsProvider");
  return ctx;
}

export function ToastsProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast: Toast = { id, ...t };
    setToasts((prev) => [toast, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed right-3 top-3 z-[60] w-[min(360px,calc(100vw-24px))] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "rounded-md border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] px-3 py-2",
              "shadow-[3px_3px_0_var(--retro-ink)]"
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className={cx(
                    "text-sm font-extrabold",
                    t.kind === "error" && "text-[var(--retro-red)]",
                    t.kind === "success" && "text-[var(--retro-cyan)]"
                  )}
                >
                  {t.title}
                </div>
                {t.message ? (
                  <div className="mt-0.5 text-xs text-[var(--retro-ink-2)]">
                    {t.message}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
