import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.suryaai.in";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/chat", "/research", "/agent", "/media", "/app-builder", "/projects"],
        disallow: ["/api/", "/settings", "/profile"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
