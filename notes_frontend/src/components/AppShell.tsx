"use client";

import React from "react";
import { cx } from "@/lib/utils";

export function AppShell({
  header,
  sidebar,
  main,
}: {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  main: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--retro-bg)] text-[var(--retro-ink)]">
      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-5">
        <div className="rounded-lg border-2 border-[var(--retro-ink)] bg-[var(--retro-paper)] shadow-[6px_6px_0_var(--retro-ink)]">
          <header className="border-b-2 border-[var(--retro-ink)] px-4 py-3">
            {header}
          </header>

          <div className={cx("grid", "grid-cols-1 md:grid-cols-[320px_1fr]")}>
            <aside className="border-b-2 border-[var(--retro-ink)] px-4 py-4 md:border-b-0 md:border-r-2">
              {sidebar}
            </aside>
            <main className="px-4 py-4">{main}</main>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--retro-ink-2)]">
          Tip: Ctrl/⌘+K focuses search • ESC closes modal
        </p>
      </div>
    </div>
  );
}
