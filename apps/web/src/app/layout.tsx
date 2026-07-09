import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import React from "react";

import { AppToaster } from "@/components/ui/toaster";

import "./globals.css";

export const metadata: Metadata = {
  title: "SME Invoice & Payment Reconciliation Platform",
  description: "Invoice and payment reconciliation workspace for Nigerian SMEs."
};

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap"
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap"
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${hankenGrotesk.variable} ${jetBrainsMono.variable}`}>
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
