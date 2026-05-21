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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.suryaai.in";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Surya AI — The Smartest Free AI Chatbot for Students & Devs",
  description:
    "Surya AI is an Indian AI chatbot for students, developers, and creators. Chat, research, build apps, summarize links, and automate tasks in one place.",
  keywords: [
    "free AI chatbot",
    "Indian AI chatbot",
    "AI assistant for students",
    "coding AI assistant",
    "best AI for research",
    "Surya AI India",
    "multi-agent AI platform",
    "free AI chat India",
  ],
  authors: [{ name: "Surya AI Team" }],
  creator: "Surya AI",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    title: "Surya AI — The AI that thinks with you",
    description: "Indian AI chatbot for chat, research, app building, link summaries, and automation.",
    siteName: "Surya AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Surya AI — The Smartest Free AI Chatbot",
    description: "Indian AI chatbot for students, developers, and creators.",
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
