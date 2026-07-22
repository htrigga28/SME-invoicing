import { afterEach, describe, expect, it } from "vitest";

import { getAllJsonLd, getMarketingMetadata, getRobotsPolicy, getSitemapEntries } from "@/lib/seo";
import { getAppLoginUrl, getMarketingAnchorHref } from "@/lib/urls";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }

  if (originalAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  }
});

describe("marketing SEO helpers", () => {
  it("builds metadata with canonical and social card data", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lumina.test";

    const metadata = getMarketingMetadata();

    expect(metadata.metadataBase?.toString()).toBe("https://lumina.test/");
    expect(metadata.description).toContain("Paystack payments");
    expect(metadata.title).toMatchObject({ default: "Lumina - Invoice Payment Clarity for Nigerian SMEs" });
    expect(metadata.alternates).toMatchObject({ canonical: "/" });
    expect(metadata.openGraph).toMatchObject({
      siteName: "Lumina",
      type: "website"
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("builds environment-driven app login URLs", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.lumina.test/";

    expect(getAppLoginUrl()).toBe("https://app.lumina.test/login");
  });

  it("keeps section anchors local on the homepage and route-aware elsewhere", () => {
    expect(getMarketingAnchorHref("/", "#outcomes")).toBe("#outcomes");
    expect(getMarketingAnchorHref("/privacy", "#outcomes")).toBe("/#outcomes");
  });

  it("returns sitemap and robots entries for public marketing routes only", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://lumina.test";

    expect(getSitemapEntries().map((entry) => entry.url)).toEqual([
      "https://lumina.test/",
      "https://lumina.test/privacy",
      "https://lumina.test/terms"
    ]);
    expect(getRobotsPolicy()).toMatchObject({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://lumina.test/sitemap.xml"
    });
  });

  it("includes required JSON-LD entities", () => {
    expect(getAllJsonLd().map((item) => item["@type"])).toEqual([
      "Organization",
      "WebSite",
      "SoftwareApplication",
      "FAQPage"
    ]);
  });
});
