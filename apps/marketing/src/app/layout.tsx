import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import type React from "react";

import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { getMarketingMetadata, marketingViewport } from "@/lib/seo";

import "./globals.css";

export const metadata: Metadata = getMarketingMetadata();
export const viewport: Viewport = marketingViewport;

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
        <MarketingHeader />
        {children}
        <MarketingFooter />
      </body>
    </html>
  );
}
