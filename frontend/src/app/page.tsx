import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.shortName} — AI 个人内容创作工作台 | 公众号·小红书·抖音`,
    template: `%s | ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.creator }],
  creator: siteConfig.creator,
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    title: `${siteConfig.shortName} — 从灵感到发布的多平台内容创作工作台`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.shortName} — AI 个人内容创作工作台`,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function HomePage() {
  return <LandingPage />;
}
