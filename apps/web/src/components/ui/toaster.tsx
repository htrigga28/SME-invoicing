"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className:
          "border border-[var(--border-default)] bg-[var(--surface-overlay)] text-[var(--text-primary)]",
        duration: 5000
      }}
    />
  );
}
