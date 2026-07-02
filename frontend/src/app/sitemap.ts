import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/workspace"),
      lastModified,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/inspirations"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/topics"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/drafts"),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    },
  ];
}
