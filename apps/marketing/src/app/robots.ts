import type { MetadataRoute } from "next";

import { getRobotsPolicy } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return getRobotsPolicy();
}
