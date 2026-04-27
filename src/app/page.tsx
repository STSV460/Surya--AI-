"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
      {/* CSS radial glow background — no Three.js */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(26,115,232,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Foreground content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center">
        {/* Logo */}
        <Image
          src="/logo.png"
          alt="Surya AI — The Smartest Free AI for Students"
          width={72}
          height={72}
          className="rounded-2xl"
          priority
        />

        {/* Wordmark */}
        <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
          Surya <span className="text-surya-500">AI</span>
        </h1>

        {/* Tagline */}
        <h2 className="text-lg text-gray-400 max-w-sm">
          The AI that thinks with you — Free AI for Students & Devs
        </h2>

        {/* Sub-description */}
        <p className="text-sm text-gray-600 max-w-md">
          Surya AI is a production-grade AI assistant for deep research, coding, and multi-agent automation. 
          Powered by Claude 3.5 Sonnet & Opus. No prompting expertise required.
        </p>

        {/* CTA */}
        <Link
          href="/chat"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surya-500 hover:bg-surya-700
            text-white font-medium text-sm transition-colors mt-2"
        >
          Start for free
          <ArrowRight size={15} />
        </Link>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {[
            "Multi-model AI",
            "Extended Thinking",
            "AI Artifacts",
            "AI Projects",
            "Voice Mode",
            "App Builder",
          ].map((feat) => (
            <span
              key={feat}
              className="px-3 py-1 rounded-full text-xs border border-white/10 text-gray-500 bg-surface-1/50"
            >
              {feat}
            </span>
          ))}
        </div>

        {/* Hidden SEO Keywords Section (For Google) */}
        <section className="sr-only">
          <h3>Best AI Chatbot for India</h3>
          <p>
            Looking for a free AI chatbot in India? Surya AI offers advanced research and coding capabilities 
            for students and professionals. Access the best AI assistant for academic work and software development.
          </p>
          <h3>Free AI Tools for Coding</h3>
          <p>
            Build apps instantly with our AI App Builder. Use the smartest AI for coding and debugging with 
            Claude 3.5 Sonnet integration.
          </p>
        </section>

        {/* Mini SEO Footer */}
        <footer className="absolute bottom-8 flex gap-6 text-[10px] uppercase tracking-widest text-gray-600">
          <Link href="/chat" className="hover:text-surya-500 transition-colors">Chat</Link>
          <Link href="/research" className="hover:text-surya-500 transition-colors">Research</Link>
          <Link href="/agent" className="hover:text-surya-500 transition-colors">Agents</Link>
          <span className="opacity-30">|</span>
          <span className="">© 2026 Surya AI India</span>
        </footer>
      </div>
    </div>
  );
}

