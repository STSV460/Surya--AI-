import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { pageMetadata, SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo";

export const metadata = pageMetadata("", SITE_TITLE, SITE_DESCRIPTION);

export default function LandingPage() {
  return (
    <main
      role="main"
      aria-label="Surya AI landing page"
      className="relative min-h-screen w-full overflow-x-hidden bg-background flex flex-col"
    >
      {/* CSS radial glow background — no Three.js */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 60%, rgba(26,115,232,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Hero section */}
      <section
        aria-labelledby="hero-heading"
        className="relative z-10 flex min-h-[85vh] flex-col items-center justify-center gap-6 px-4 text-center"
      >
        {/* Logo */}
        <Image
          src="/logo.png"
          alt="Surya AI logo"
          aria-label="Surya AI logo"
          role="img"
          width={72}
          height={72}
          className="rounded-2xl"
          priority
        />

        {/* Wordmark */}
        <h1
          id="hero-heading"
          aria-label="Surya AI"
          className="text-5xl font-bold tracking-tight text-white sm:text-6xl"
        >
          Surya <span className="text-surya-500">AI</span>
        </h1>

        {/* Tagline */}
        <h2
          aria-label="Tagline"
          className="text-lg text-gray-400 max-w-sm"
        >
          The AI that thinks with you — Free AI for Students & Devs
        </h2>

        {/* Sub-description */}
        <p
          aria-label="Description"
          className="text-sm text-gray-600 max-w-md"
        >
          Surya AI is an Indian AI chatbot for deep research, coding, app building, link summaries, and automation.
          No prompting expertise required.
        </p>

        {/* CTA */}
        <Link
          href="/chat"
          aria-label="Start for free — go to Surya AI chat"
          role="button"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-surya-500 hover:bg-surya-700
            text-white font-medium text-sm transition-colors mt-2"
        >
          Start for free
          <ArrowRight size={15} aria-hidden="true" />
        </Link>

        {/* Feature pills */}
        <ul
          aria-label="Surya AI features"
          className="flex flex-wrap items-center justify-center gap-2 mt-2 list-none p-0 m-0"
        >
          {[
            "Multi-model AI",
            "Extended Thinking",
            "AI Artifacts",
            "AI Projects",
            "Voice Mode",
            "Code",
          ].map((feat) => (
            <li
              key={feat}
              aria-label={feat}
              className="px-3 py-1 rounded-full text-xs border border-white/10 text-gray-500 bg-surface-1/50"
            >
              {feat}
            </li>
          ))}
        </ul>

        {/* Mini SEO Footer */}
        <footer
          role="contentinfo"
          aria-label="Site footer"
          className="absolute bottom-8 flex flex-wrap justify-center gap-6 px-4 text-[10px] uppercase tracking-widest text-gray-600"
        >
          <nav aria-label="Footer navigation" className="flex gap-6">
            <Link href="/chat" aria-label="Open Chat" className="hover:text-surya-500 transition-colors">Chat</Link>
            <Link href="/projects" aria-label="View Projects" className="hover:text-surya-500 transition-colors">Projects</Link>
            <Link href="/app-builder" aria-label="Open Code" className="hover:text-surya-500 transition-colors">Code</Link>
            <span aria-hidden="true" className="opacity-30">|</span>
            <Link href="/privacy" aria-label="Privacy Policy" className="hover:text-surya-500 transition-colors">Privacy</Link>
            <Link href="/terms" aria-label="Terms of Service" className="hover:text-surya-500 transition-colors">Terms</Link>
          </nav>
          <span aria-hidden="true" className="opacity-30">|</span>
          <span aria-label="Copyright">© 2026 Surya AI India</span>
        </footer>
      </section>

      {/* Feature Details Grid */}
      <section className="relative z-10 mx-auto grid w-full max-w-5xl gap-10 px-4 pb-20 text-left md:grid-cols-3">
        {[
          {
            title: "Free AI Chatbot",
            body: "Ask questions, draft content, summarize links, and explore ideas with a fast AI assistant built for students, developers, and creators.",
          },
          {
            title: "AI for Students",
            body: "Use Surya AI for research notes, essay outlines, exam prep, lecture summaries, and clear explanations for difficult topics.",
          },
          {
            title: "AI Coding Assistant",
            body: "Plan apps, debug code, refactor components, and turn product ideas into working software with app builder workflows.",
          },
        ].map((item) => (
          <article key={item.title} className="border-t border-white/10 pt-6">
            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-gray-500">{item.body}</p>
          </article>
        ))}
      </section>

      {/* FAQ Accordions Section */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 text-left border-t border-white/5 pt-12">
        <h2 className="text-2xl font-semibold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <details className="group border border-white/10 rounded-2xl bg-surface-1/30 p-6 transition-all duration-300 open:bg-surface-1/50" name="faq-accordion">
            <summary className="flex items-center justify-between font-medium text-white cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>What is Surya AI?</span>
              <span className="transition duration-300 group-open:rotate-180 text-surya-400">
                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
              </span>
            </summary>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              Surya AI is a free Indian AI chatbot designed specifically for students, developers, and creators. It offers advanced capabilities like multi-agent coding workflows, deep academic research, automated document and link summaries, and real-time voice mode.
            </p>
          </details>

          <details className="group border border-white/10 rounded-2xl bg-surface-1/30 p-6 transition-all duration-300 open:bg-surface-1/50" name="faq-accordion">
            <summary className="flex items-center justify-between font-medium text-white cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>Is Surya AI free to use?</span>
              <span className="transition duration-300 group-open:rotate-180 text-surya-400">
                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
              </span>
            </summary>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              Yes, Surya AI is completely free to use. We aim to democratize high-performance AI access for Indian students and builders without any paid subscription barriers.
            </p>
          </details>

          <details className="group border border-white/10 rounded-2xl bg-surface-1/30 p-6 transition-all duration-300 open:bg-surface-1/50" name="faq-accordion">
            <summary className="flex items-center justify-between font-medium text-white cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>How does Surya AI help students and developers in India?</span>
              <span className="transition duration-300 group-open:rotate-180 text-surya-400">
                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
              </span>
            </summary>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              For students, Surya AI acts as a research assistant that explains complex subjects, summarizes lectures, and aids in exam preparation. For developers, it is an advanced coding workbench featuring live app previews (AI Artifacts) and multi-agent loops to solve complex engineering challenges.
            </p>
          </details>

          <details className="group border border-white/10 rounded-2xl bg-surface-1/30 p-6 transition-all duration-300 open:bg-surface-1/50" name="faq-accordion">
            <summary className="flex items-center justify-between font-medium text-white cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span>What is Lighthouse Attention?</span>
              <span className="transition duration-300 group-open:rotate-180 text-surya-400">
                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
              </span>
            </summary>
            <p className="mt-4 text-sm leading-relaxed text-gray-500">
              Lighthouse Attention is a three-branch sparse-attention mechanism (Compress, Select, Sliding Window) combined with a final dense Heal stage. This allows Surya GPT v2 to process up to 128k context windows while achieving a 3× to 7× reduction in GPU training costs compared to dense attention.
            </p>
          </details>
        </div>
      </section>

      {/* Official Directory and Backlinks */}
      <section className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-28 text-left">
        <h2 className="text-2xl font-semibold text-white">Surya AI official website</h2>
        <p className="mt-4 text-sm leading-7 text-gray-500">
          Surya AI is available at suryaai.in. The platform combines chat, research, code generation,
          AI artifacts, media tools, projects, and automation in one web app. These public pages help
          Google understand that Surya AI, SuryaAI, and suryaai.in refer to the official Surya AI website.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/ai-for-students" className="text-sm font-medium text-surya-400 hover:text-surya-300">
            AI for students
          </Link>
          <Link href="/ai-for-coding" className="text-sm font-medium text-surya-400 hover:text-surya-300">
            AI for coding
          </Link>
          <Link href="/research/surya-gpt" className="text-sm font-medium text-surya-400 hover:text-surya-300">
            Surya GPT research proposal
          </Link>
        </div>
      </section>
    </main>
  );
}
