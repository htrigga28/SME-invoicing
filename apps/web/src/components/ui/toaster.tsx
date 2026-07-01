"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        className: "border border-slate-200",
        duration: 5000
      }}
    />
  );
}
