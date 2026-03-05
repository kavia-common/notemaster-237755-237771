import type { Metadata } from "next";
import "./globals.css";
import { ToastsProvider } from "@/components/ui/Toasts";

export const metadata: Metadata = {
  title: "NoteMaster ’96",
  description: "Retro notes app with tags, search, and autosave.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ToastsProvider>{children}</ToastsProvider>
      </body>
    </html>
  );
}
