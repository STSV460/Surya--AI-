import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.suryaai.in";
  const now = new Date();

  const routes: Array<{ path: string; priority: number; changeFrequency: "weekly" | "monthly" | "daily" }> = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/chat", priority: 0.9, changeFrequency: "daily" },
    { path: "/login", priority: 0.7, changeFrequency: "monthly" },
    { path: "/projects", priority: 0.7, changeFrequency: "weekly" },
    { path: "/media", priority: 0.7, changeFrequency: "weekly" },
    { path: "/app-builder", priority: 0.7, changeFrequency: "weekly" },
    { path: "/settings", priority: 0.4, changeFrequency: "monthly" },
  ];

  return routes.map((r) => ({
    url: `${base}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
