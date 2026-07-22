import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/urls";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lumina",
    short_name: "Lumina",
    description: "Know what got paid without the spreadsheet chase.",
    start_url: getSiteUrl(),
    display: "standalone",
    background_color: "#070A08",
    theme_color: "#070A08",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png"
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  };
}
