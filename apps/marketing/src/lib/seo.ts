import type { Metadata, Viewport } from "next";

import { faq, siteConfig } from "@/content/site-copy";
import { getAbsoluteSiteUrl, getSiteUrl } from "@/lib/urls";

export function getMarketingMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const title = "Lumina - Receivables for Growing Businesses";
  const description =
    "Turn every invoice into predictable cash. Lumina helps growing businesses create professional invoices, collect Paystack payments, reconcile what arrived, and know what needs attention.";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: "%s | Lumina"
    },
    description,
    applicationName: "Lumina",
    authors: [{ name: "Lumina" }],
    creator: "Lumina",
    alternates: {
      canonical: "/"
    },
    openGraph: {
      title,
      description,
      url: siteUrl,
      siteName: "Lumina",
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Lumina — turn every invoice into predictable cash."
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    }
  };
}

export const marketingViewport: Viewport = {
  colorScheme: "light",
  themeColor: "#FAFAF7"
};

export function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lumina",
    url: getSiteUrl(),
    description: siteConfig.descriptor,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: siteConfig.contactEmail
    }
  };
}

export function getWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Lumina",
    url: getSiteUrl(),
    description: siteConfig.positioning
  };
}

export function getSoftwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Lumina",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: getSiteUrl(),
    description: siteConfig.positioning
  };
}

export function getFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
      }
    }))
  };
}

export function getAllJsonLd() {
  return [
    getOrganizationJsonLd(),
    getWebSiteJsonLd(),
    getSoftwareApplicationJsonLd(),
    getFaqJsonLd()
  ];
}

export function getSitemapEntries() {
  const now = new Date();

  return [
    {
      url: getAbsoluteSiteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 1
    },
    {
      url: getAbsoluteSiteUrl("/privacy"),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.4
    },
    {
      url: getAbsoluteSiteUrl("/terms"),
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.4
    }
  ];
}

export function getRobotsPolicy() {
  return {
    rules: {
      userAgent: "*",
      allow: "/"
    },
    sitemap: getAbsoluteSiteUrl("/sitemap.xml")
  };
}
