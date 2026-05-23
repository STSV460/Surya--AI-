import Link from "next/link";
import { ArrowRight, Code2, Cpu, Zap, Layout } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/ai-for-coding",
  "AI Coding Assistant and App Builder for Developers",
  "Build, debug, refactor, and research with Surya AI, an AI coding assistant with app building, artifacts, and multi-agent workflows."
);

export default function CodingSEO() {
  return (
    <div className="relative min-h-screen w-full bg-background flex flex-col items-center py-20 px-4">
      <div className="relative z-10 max-w-4xl w-full text-center flex flex-col items-center gap-8">
        <div className="p-3 rounded-2xl bg-surya-500/10 border border-surya-500/20 mb-2">
          <Code2 size={40} className="text-surya-500" />
        </div>
        
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Code Faster with <span className="text-surya-500">Multi-Agent AI</span>
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl font-mono">
          Surya AI isn&apos;t just a chatbot. It&apos;s a production-grade workbench that builds, debugs, and refactors
          with you in real-time.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-8">
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 text-left flex gap-4">
            <Zap className="text-surya-400 shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Instant App Builder</h3>
              <p className="text-sm text-gray-500">Generate fully functional React components and apps from a single prompt.</p>
            </div>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 text-left flex gap-4">
            <Layout className="text-surya-400 shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-medium text-white mb-1">AI Artifacts</h3>
              <p className="text-sm text-gray-500">Live previews for your code, diagrams, and UI designs. Iterate at the speed of thought.</p>
            </div>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 text-left flex gap-4">
            <Cpu className="text-surya-400 shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Advanced Coding AI</h3>
              <p className="text-sm text-gray-500">Strong coding intelligence with extended context and deep reasoning.</p>
            </div>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 text-left flex gap-4">
            <Code2 className="text-surya-400 shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Agentic Workflows</h3>
              <p className="text-sm text-gray-500">Multi-agent systems that can research, plan, and execute complex coding tasks.</p>
            </div>
          </div>
        </div>

        <Link
          href="/chat"
          className="flex items-center gap-2 px-8 py-4 rounded-xl bg-surya-500 hover:bg-surya-700
            text-white font-semibold text-lg transition-all transform hover:scale-105 mt-8 shadow-lg shadow-surya-500/20"
        >
          Open the Workbench
          <ArrowRight size={20} />
        </Link>

        <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
          <span>TypeScript</span>
          <span className="opacity-30">•</span>
          <span>Python</span>
          <span className="opacity-30">•</span>
          <span>React</span>
          <span className="opacity-30">•</span>
          <span>Next.js</span>
          <span className="opacity-30">•</span>
          <span>Rust</span>
        </div>
      </div>

      {/* Semantic SEO Text Block */}
      <article className="max-w-3xl w-full mt-24 text-gray-500 space-y-6 text-sm leading-relaxed border-t border-white/5 pt-12">
        <h2 className="text-white text-xl font-semibold">The Best Coding AI Assistant for Professional Developers</h2>
        <p>
          Developers today need more than just code completion. You need a system that understands architecture, 
          state management, and modern best practices. Surya AI provides high-fidelity coding assistance
          that feels like pair-programming with a senior engineer.
        </p>
        <p>
          Our <strong>AI Artifacts</strong> feature allows you to see your code in action immediately, reducing the feedback loop 
          from minutes to seconds. Whether you are refactoring a legacy codebase or starting a new project in India&apos;s
          thriving tech ecosystem, Surya AI is the production-ready companion you&apos;ve been looking for.
        </p>
      </article>
    </div>
  );
}
