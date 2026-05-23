import type { Metadata } from "next";

export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.suryaai.in";
export const SITE_NAME = "Surya AI";
export const SITE_TITLE = "Surya AI - Free AI Chatbot for Students, Developers, and Creators";
export const SITE_DESCRIPTION =
  "Surya AI is a free Indian AI chatbot for students, developers, and creators. Use it for research, coding, app building, link summaries, AI artifacts, and automation.";

export const PUBLIC_ROUTES = [
  {
    path: "",
    priority: 1,
    changeFrequency: "weekly" as const,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  {
    path: "/ai-for-students",
    priority: 0.9,
    changeFrequency: "weekly" as const,
    title: "Best Free AI Assistant for Students | Surya AI",
    description:
      "Study faster with Surya AI. Get help with academic research, essay planning, summaries, exam prep, and complex problem solving.",
  },
  {
    path: "/ai-for-coding",
    priority: 0.9,
    changeFrequency: "weekly" as const,
    title: "AI Coding Assistant and App Builder for Developers | Surya AI",
    description:
      "Build, debug, refactor, and research with Surya AI, an AI coding assistant with app building, artifacts, and multi-agent workflows.",
  },
  {
    path: "/research/surya-gpt",
    priority: 0.8,
    changeFrequency: "weekly" as const,
    title: "Surya GPT - Sovereign Indic Agentic Model Proposal | Surya AI",
    description:
      "Strategic partnership proposal for Surya GPT, India's sovereign agentic foundation model built around the cost-efficient Lighthouse Attention framework.",
  },
  {
    path: "/privacy",
    priority: 0.3,
    changeFrequency: "yearly" as const,
    title: "Privacy Policy | Surya AI",
    description: "Privacy Policy for Surya AI, including how data is collected, used, and protected.",
  },
  {
    path: "/terms",
    priority: 0.3,
    changeFrequency: "yearly" as const,
    title: "Terms of Service | Surya AI",
    description: "Terms of Service for Surya AI, including rules for using the platform.",
  },
];

export function absoluteUrl(path = "") {
  return `${SITE_URL}${path}`;
}

export function canonical(path = "") {
  return path || "/";
}

export function pageMetadata(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: canonical(path),
    },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      siteName: SITE_NAME,
      type: "website",
      locale: "en_IN",
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} preview`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/twitter-image.png"],
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
}

export const privateMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export function siteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: absoluteUrl("/logo.png"),
      sameAs: [SITE_URL],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en-IN",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "AIApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Surya AI?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Surya AI is a free Indian AI chatbot designed specifically for students, developers, and creators. It offers advanced features such as multi-agent coding workflows, deep academic research, automated document and link summaries, and real-time voice mode."
          }
        },
        {
          "@type": "Question",
          name: "Is Surya AI free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes, Surya AI is completely free to use. It provides access to high-performance language, coding, and multi-agent systems without any paid subscription requirements."
          }
        },
        {
          "@type": "Question",
          name: "How does Surya AI help students and developers in India?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "For students, Surya AI offers deep research tools, lecture summarization, and exam preparation. For developers, it functions as a advanced AI coding assistant and app builder with instant previews (AI Artifacts) and multi-agent planning frameworks."
          }
        },
        {
          "@type": "Question",
          name: "What is Lighthouse Attention?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Lighthouse Attention is a state-of-the-art sparse-attention training framework. It uses a three-branch approach—Compress (global context), Select (local detail), and Sliding Window (continuity)—followed by a dense Heal stage. This architecture provides 128k context length at a fraction of standard GPU training costs."
          }
        }
      ]
    }
  ];
}
