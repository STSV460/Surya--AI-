import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: PUBLIC_ROUTES.map((route) => route.path || "/"),
        disallow: [
          "/api/",
          "/chat",
          "/projects",
          "/media",
          "/app-builder",
          "/crew-builder",
          "/settings",
          "/login",
          "/profile",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
