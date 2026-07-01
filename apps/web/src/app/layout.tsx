import type { Metadata } from "next";
import React from "react";

import { AppToaster } from "@/components/ui/toaster";

import "./globals.css";

export const metadata: Metadata = {
  title: "SME Invoice & Payment Reconciliation Platform",
  description: "Invoice and payment reconciliation workspace for Nigerian SMEs."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
