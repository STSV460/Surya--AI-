import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Surya AI — The Smartest Free AI Chatbot for Students & Devs",
  description:
    "Surya AI is a production-grade multi-agent AI assistant. Chat, research, build apps, and automate tasks with Claude 3.5 Sonnet & Opus. Free AI for students and developers.",
  keywords: [
    "free AI chatbot",
    "AI assistant for students",
    "coding AI assistant",
    "best AI for research",
    "Surya AI India",
    "multi-agent AI platform",
    "free Claude 3.5 chat",
  ],
  authors: [{ name: "Surya AI Team" }],
  creator: "Surya AI",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://surya-ai.com",
    title: "Surya AI — The AI that thinks with you",
    description: "Production-grade AI assistant. Chat, research, build apps, and automate your work.",
    siteName: "Surya AI",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Surya AI Dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Surya AI — The Smartest Free AI Chatbot",
    description: "Multi-agent AI platform for students and developers.",
    images: ["/og-image.png"],
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
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
