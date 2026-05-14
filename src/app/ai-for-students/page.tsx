import Image from "next/image";
import Link from "next/link";
import { ArrowRight, GraduationCap, BookOpen, Sparkles } from "lucide-react";

export const metadata = {
  title: "Best Free AI Assistant for Students | Surya AI",
  description: "Boost your studies with Surya AI. The smartest free AI for academic research, essay planning, and complex problem solving. Used by students in India and worldwide.",
};

export default function StudentsSEO() {
  return (
    <div className="relative min-h-screen w-full bg-background flex flex-col items-center py-20 px-4">
      <div className="relative z-10 max-w-4xl w-full text-center flex flex-col items-center gap-8">
        <GraduationCap size={48} className="text-surya-500 mb-2" />
        
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          The Ultimate <span className="text-surya-500">AI Sidekick</span> for Students
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl">
          From deep research papers to solving complex math, Surya AI helps you learn faster and score better. 
          The smarter way to study is here.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mt-8">
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 text-left">
            <BookOpen className="text-surya-400 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Deep Research</h3>
            <p className="text-sm text-gray-500">AI that actually reads and synthesizes information for your assignments.</p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 text-left">
            <Sparkles className="text-surya-400 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Essay Assistant</h3>
            <p className="text-sm text-gray-500">Brainstorm, outline, and refine your writing with production-grade AI.</p>
          </div>
          <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 text-left">
            <GraduationCap className="text-surya-400 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Exams & Prep</h3>
            <p className="text-sm text-gray-500">Summarize long lectures and generate practice tests instantly.</p>
          </div>
        </div>

        <Link
          href="/chat"
          className="flex items-center gap-2 px-8 py-4 rounded-xl bg-surya-500 hover:bg-surya-700
            text-white font-semibold text-lg transition-all transform hover:scale-105 mt-8 shadow-lg shadow-surya-500/20"
        >
          Try Surya AI for Free
          <ArrowRight size={20} />
        </Link>

        <p className="text-xs text-gray-600 mt-4">
          Trusted by students from IIT, DU, and universities globally.
        </p>
      </div>

      {/* Semantic SEO Text Block */}
      <article className="max-w-3xl w-full mt-24 text-gray-500 space-y-6 text-sm leading-relaxed">
        <h2 className="text-white text-xl font-semibold">Why is Surya AI the best AI for students in India?</h2>
        <p>
          Indian students often need AI tools that are not only powerful but also accessible and reliable. 
          Surya AI provides a premium experience with Claude Sonnet 4.6, allowing you to tackle engineering,
          humanities, and medical research with ease. Unlike basic chatbots, our multi-agent system can 
          handle long-form research tasks that help you excel in your academic journey.
        </p>
        <p>
          Whether you are looking for an AI to help with your thesis, a math problem solver, or a tool to 
          summarize PDFs, Surya AI is built to understand search intent and provide accurate, human-like responses.
        </p>
      </article>
    </div>
  );
}
