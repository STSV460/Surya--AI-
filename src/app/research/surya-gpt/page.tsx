import Link from "next/link";
import { ArrowLeft, Mail, Globe, Cpu, Users, Shield, Landmark, Code, FileText, CheckCircle2 } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "/research/surya-gpt",
  "Surya GPT — India's Sovereign Agentic Foundation Model",
  "Strategic partnership and fundraising proposal for Surya GPT, a 13B total / 2B active MoE foundation model utilizing Lighthouse Attention."
);

export default function SuryaGptProposalPage() {
  const sections = [
    { id: "about-founder", label: "1. About the Founder" },
    { id: "problem-why-india", label: "2. The Problem" },
    { id: "what-built", label: "3. What We Have Built" },
    { id: "funding-cost-buckets", label: "4. Cost Buckets" },
    { id: "team-needed", label: "5. Team We Need" },
    { id: "useful-for-india", label: "6. Why Useful for India" },
    { id: "achievable-expectations", label: "7. Expectations" },
    { id: "parallel-funding", label: "8. Funding Tracks" },
    { id: "architecture-proof", label: "9. Codebase Proof" },
    { id: "asks-next-steps", label: "10. Asks & Next Steps" },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-surya-500 selection:text-white">
      {/* Visual top glow line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-surya-500 to-transparent opacity-80" />

      {/* Grid overlay background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Navigation header */}
        <header className="mb-12 flex items-center justify-between border-b border-white/5 pb-6">
          <Link
            href="/"
            className="group flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to homepage
          </Link>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>v2-lighthouse branch</span>
            <span className="opacity-30">|</span>
            <span>May 2026</span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
          {/* Table of contents sticky sidebar (desktop) */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-8 rounded-2xl border border-white/5 bg-surface-1/30 p-6">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">
                On This Page
              </h4>
              <nav className="space-y-2">
                {sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="block text-xs text-gray-500 hover:text-surya-400 transition-colors py-1"
                  >
                    {sec.label}
                  </a>
                ))}
              </nav>
              <div className="mt-8 border-t border-white/5 pt-6">
                <p className="text-[11px] leading-relaxed text-gray-600">
                  Sovereign Agentic Foundation Model Proposal
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <a
                    href="mailto:pvshariharan324@gmail.com"
                    className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    <Mail size={12} />
                    pvshariharan324@gmail.com
                  </a>
                  <a
                    href="https://suryaai.in"
                    className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    <Globe size={12} />
                    suryaai.in
                  </a>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-3">
            <article className="prose prose-invert max-w-none space-y-16">
              
              {/* Document Cover Header */}
              <section className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-surya-500/20 bg-surya-500/5 text-surya-400">
                  <Cpu size={14} /> Sovereign Indian Foundation Model
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl font-heading">
                  Surya GPT
                </h1>
                <p className="text-xl text-gray-400 font-light leading-relaxed max-w-3xl">
                  India’s Sovereign Agentic Foundation Model. A strategic blueprint and fundraising document for scaling a 13B total / 2B active MoE LLM utilizing Lighthouse Attention.
                </p>
                
                {/* Meta details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 border-y border-white/5 py-6 mt-8 text-sm">
                  <div>
                    <span className="block text-xs text-gray-600 uppercase tracking-wider mb-1">Founder</span>
                    <strong className="text-white">Prabhas (Pvshariharan)</strong>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-600 uppercase tracking-wider mb-1">Contact</span>
                    <a href="mailto:pvshariharan324@gmail.com" className="text-surya-400 hover:underline">
                      pvshariharan324@gmail.com
                    </a>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-600 uppercase tracking-wider mb-1">Repository</span>
                    <span className="text-white font-mono text-xs">surya-gpt (v2-lighthouse)</span>
                  </div>
                </div>
              </section>

              {/* 1. About the Founder */}
              <section id="about-founder" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Users size={20} className="text-surya-500" />
                  1. About the Founder
                </h2>
                <div className="space-y-4 text-gray-400 text-sm leading-relaxed">
                  <p>
                    I am <strong>Prabhas</strong>, an Indian student-founder and the sole engineer behind 
                    Surya AI — a production-grade multi-model AI chatbot platform live today at{" "}
                    <a href="https://suryaai.in" className="text-surya-400 hover:underline">https://suryaai.in</a>. 
                    Surya AI already routes user prompts across Claude, Gemini, and GPT models, ships an Indic-first user interface, 
                    runs an agentic workflow engine for tool-use tasks, and has been hardened for production with security 
                    testing and OWASP-aligned controls — all built by me, single-handedly, before raising any external capital.
                  </p>
                  <p>
                    I am building <strong>Surya GPT</strong> as the next step: India’s own from-scratch closed-source agentic 
                    foundation model that powers Surya AI end-to-end and is licensable to Indian enterprises, government 
                    bodies, and Global South partners through a sovereign API.
                  </p>
                  <div className="rounded-2xl border border-white/5 bg-surface-1/30 p-6 mt-6">
                    <h4 className="text-xs font-semibold uppercase tracking-widest text-surya-400 mb-2">Why Now?</h4>
                    <p className="text-xs leading-relaxed">
                      A January 2026 research paper (<strong>Lighthouse Attention</strong>, Subhag Goch et al.) demonstrates a 
                      three-step sparse-attention training framework (Compress → Select → Heal) that delivers approximately 
                      <strong> 3–7× cost reduction at iso-quality</strong> versus dense attention, with up to 21× training 
                      throughput at long context. Combined with the maturity of open multimodal bases (Flux, CogVideoX, F5-TTS, Whisper) 
                      and Indic data corpora (AI4Bharat Sangraha, IndicSUPERB), the economic window to train a sovereign Indian 
                      foundation model has opened for the first time. I have already implemented Lighthouse Attention in code, 
                      validated it locally on Apple M4 hardware, and merged it into a 13B-parameter / 2B-active Mixture-of-Experts 
                      skeleton — at zero cloud spend so far. The next step is compute.
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. The Problem */}
              <section id="problem-why-india" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Globe size={20} className="text-surya-500" />
                  2. The Problem — Why India Needs Surya GPT
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/20 space-y-3">
                    <h3 className="text-white font-semibold">2.1 Cost Gap</h3>
                    <p className="text-gray-500 leading-relaxed">
                      Foreign frontier LLMs (GPT-5, Claude 4.7, Gemini 3.5 Pro) charge <strong>₹400–₹6,000 per million output tokens</strong> (~$5–$75 USD). For Indian EdTech, AgriTech, rural healthcare, MSMEs, and government-citizen workloads, this is <strong>200× to 6,000× too expensive</strong>.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/20 space-y-3">
                    <h3 className="text-white font-semibold">2.2 Language Gap</h3>
                    <p className="text-gray-500 leading-relaxed">
                      India has <strong>22 official languages</strong> and 600M+ non-English users. Foreign models treat Indic languages as second-class: poor BPE tokenizer efficiency (3-5× more tokens per word), zero cultural grounding, and weak Hinglish/code-switched support.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/20 space-y-3">
                    <h3 className="text-white font-semibold">2.3 Sovereignty Gap</h3>
                    <p className="text-gray-500 leading-relaxed">
                      India lacks a domestic foundation model on the agentic tool-use frontier. Under the <strong>DPDP Act 2023</strong>, Indian government, PSU, BFSI, and defence workloads cannot legally or strategically send sensitive prompts to overseas server regions.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/20 space-y-3">
                    <h3 className="text-white font-semibold">2.4 Talent + GWS Gap</h3>
                    <p className="text-gray-500 leading-relaxed">
                      Top Indian ML talent is currently exported to Silicon Valley due to the lack of home-grown foundation model initiatives. A sovereign project keeps <strong>Global Workforce Skill (GWS)</strong> local, anchoring high-paying engineering jobs in India.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. What We Have Built */}
              <section id="what-built" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-surya-500" />
                  3. What We Have Already Built (Proof of Concept)
                </h2>
                <p className="text-sm text-gray-500">
                  Developed entirely on local Apple M4 hardware using PyTorch MPS backends. <strong>Total cloud spend to date: ₹0.</strong>
                </p>
                
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-surface-1/30">
                  <table className="min-w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="p-4 font-semibold text-white">Component</th>
                        <th className="p-4 font-semibold text-white">Shipped Capability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-400">
                      <tr>
                        <td className="p-4 font-medium text-white">Surya AI Client Interface</td>
                        <td className="p-4">Live consumer chatbot at <a href="https://suryaai.in" className="text-surya-400">suryaai.in</a>. Multi-model routing, chat UI, security-hardened.</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Model Architecture</td>
                        <td className="p-4">13B MoE (2B active) decoder. GQA 4:1, YaRN RoPE (8k to 128k context), switchable attention mode (`lighthouse` ↔ `dense`).</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Lighthouse Attention</td>
                        <td className="p-4">Three-branch sparse block (Compress K=32, Select top-N=16, Sliding window W=1024) with gated combination. Matches dense baseline within 1e-4 tolerance.</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Agentic Loop</td>
                        <td className="p-4">ReAct loop (plan → parallel tool dispatch → execution → critique → final answer) with N=3 retry ceiling. Streaming Server-Sent Events (SSE).</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">URL / Document Parsing</td>
                        <td className="p-4">Dedicated parsers for YouTube transcriptions (yt-dlp), GitHub, arXiv metadata, Amazon scraper, and readability engines.</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Grounding & Search</td>
                        <td className="p-4">Five-tier fallback search engine: SearXNG, Tavily, Brave, Bing, and aioboto3 Cloudflare R2 crawled document cache.</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Security & Tests</td>
                        <td className="p-4">15/15 unit and integration tests passing. 4-class indirect prompt injection test suite blocked. MPS smoke pretrain passes.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 4. Funding / Cost Buckets */}
              <section id="funding-cost-buckets" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Landmark size={20} className="text-surya-500" />
                  4. Why We Need Funding — Cost Structure
                </h2>
                <p className="text-sm text-gray-500">
                  Conversions based on 1 USD ≈ ₹83.50 INR. Cloud Compute is our primary training expense.
                </p>

                <div className="space-y-6">
                  {/* Compute table */}
                  <div className="rounded-2xl border border-white/5 bg-surface-1/30 p-6 space-y-4">
                    <h3 className="text-white text-sm font-semibold">4.1 Cloud Compute (Modal Pretraining H100 Cluster)</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            <th className="p-3 font-semibold text-white">Token Budget</th>
                            <th className="p-3 font-semibold text-white">INR Cost</th>
                            <th className="p-3 font-semibold text-white">USD Cost</th>
                            <th className="p-3 font-semibold text-white">EUR Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-400">
                          <tr>
                            <td className="p-3 text-white font-medium">500 Billion Tokens (Lean)</td>
                            <td className="p-3 text-surya-400 font-semibold">₹50,00,000 INR</td>
                            <td className="p-3">~$60,000 USD</td>
                            <td className="p-3">~€56,000 EUR</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-white font-medium">750 Billion Tokens (Recommended)</td>
                            <td className="p-3 text-surya-400 font-semibold">₹95,00,000 INR</td>
                            <td className="p-3">~$114,000 USD</td>
                            <td className="p-3">~€106,000 EUR</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-white font-medium">1 Trillion Tokens (Full Quality)</td>
                            <td className="p-3 text-surya-400 font-semibold">₹1,60,00,000 INR</td>
                            <td className="p-3">~$190,000 USD</td>
                            <td className="p-3">~€178,000 EUR</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      * Up to 70% of this cost is offsettable via cloud credit grant programs (Azure $150k, Google Cloud $200k, AWS $100k).
                    </p>
                  </div>

                  {/* Operational cost cards grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
                    <div className="p-4 rounded-xl border border-white/5 bg-surface-1/20">
                      <strong className="text-white block mb-1">4.2 Storage (R2 50TB Cache)</strong>
                      <span>₹6,00,000 – ₹10,00,000 INR / year</span>
                      <span className="block text-gray-600">($7,000 – $12,000 USD / €6,500 – €11,000 EUR)</span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-surface-1/20">
                      <strong className="text-white block mb-1">4.3 serving Infrastructure (Autoscaling)</strong>
                      <span>₹3,00,000 – ₹15,00,000 INR / month</span>
                      <span className="block text-gray-600">($3,600 – $18,000 USD / €3,300 – €16,600 EUR)</span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-surface-1/20">
                      <strong className="text-white block mb-1">4.4 Data Licences (Flux, CogVideoX, WebTraces)</strong>
                      <span>₹8,00,000 – ₹25,00,000 INR / year</span>
                      <span className="block text-gray-600">($9,600 – $30,000 USD / €8,900 – €27,700 EUR)</span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-surface-1/20">
                      <strong className="text-white block mb-1">4.5 API Foundations (Teacher Models & Search)</strong>
                      <span>₹4,00,000 – ₹12,00,000 INR (one-time)</span>
                      <span className="block text-gray-600">($4,800 – $14,400 USD / €4,400 – €13,300 EUR)</span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-surface-1/20">
                      <strong className="text-white block mb-1">4.7 Legal & Compliance (DPDP Act, Patents)</strong>
                      <span>₹2,00,000 – ₹8,00,000 INR (one-time)</span>
                      <span className="block text-gray-600">($2,400 – $9,600 USD / €2,200 – €8,900 EUR)</span>
                    </div>

                    <div className="p-4 rounded-xl border border-white/5 bg-surface-1/20">
                      <strong className="text-white block mb-1">4.8 Red Teaming & Penetration Audits</strong>
                      <span>₹5,00,000 – ₹15,00,000 INR</span>
                      <span className="block text-gray-600">($6,000 – $18,000 USD / €5,500 – €16,600 EUR)</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 5. Team We Need */}
              <section id="team-needed" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Users size={20} className="text-surya-500" />
                  5. The Team We Need — 5 ML Engineers (Bangalore Market)
                </h2>
                <p className="text-sm text-gray-500">
                  Combined annual budget: <strong>₹1.7 Crore – ₹4 Crore INR</strong> ($205,000 – $480,000 USD).
                </p>

                <div className="space-y-4">
                  {[
                    {
                      role: "Pretrain Lead",
                      salary: "₹50 Lakh – ₹1.2 Crore / year",
                      usd: "$60,000 – $145,000 USD",
                      scope: "DeepSpeed ZeRO-3 coordination, 32× H100 scale-up of Lighthouse Attention, gradient stabilization, checkpoint failover.",
                      gates: "Phase 3 (pretrain) + 4 (heal)",
                    },
                    {
                      role: "Post-train / RL Engineer",
                      salary: "₹35 Lakh – ₹85 Lakh / year",
                      usd: "$42,000 – $102,000 USD",
                      scope: "SFT curation (1M prompts), DPO safety alignment, GRPO + reasoning RL (verifiable math/coding rewards), Agentic RL evaluations.",
                      gates: "Phase 5 (alignment + reasoning RL)",
                    },
                    {
                      role: "Multimodal Engineer (image / video / audio)",
                      salary: "₹30 Lakh – ₹70 Lakh / year",
                      usd: "$36,000 – $84,000 USD",
                      scope: "Flux.1 LoRA matching, CogVideoX temporal adapters, F5-TTS 400M Indic architecture from scratch, Whisper Indic tuning, Moshi speech-text duplex.",
                      gates: "Phase 7 (image) + 8 (video) + 9 (audio)",
                    },
                    {
                      role: "Inference / Serving Engineer",
                      salary: "₹30 Lakh – ₹70 Lakh / year",
                      usd: "$36,000 – $84,000 USD",
                      scope: "AWQ INT4 quantization, speculative decoding (Surya-Nano 1B), vLLM continuous batching, autoscaling configurations, latency tuning.",
                      gates: "Phase 11 (inference) + 12 (deploy)",
                    },
                    {
                      role: "Data / Evaluation Engineer",
                      salary: "₹25 Lakh – ₹60 Lakh / year",
                      usd: "$30,000 – $72,000 USD",
                      scope: "FineWeb-Edu deduping, AI4Bharat integration, MinHash filters, curriculum data mixes, evaluation harnesses (MT-Bench, IFEval, FreshQA).",
                      gates: "Phase 1 (data) + cross-cutting evaluations",
                    },
                  ].map((eng, idx) => (
                    <div key={idx} className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 flex flex-col md:flex-row md:items-start justify-between gap-4 text-sm">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-white">{eng.role}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed max-w-xl">{eng.scope}</p>
                        <div className="text-[11px] text-gray-600">
                          <strong>Gates:</strong> {eng.gates}
                        </div>
                      </div>
                      <div className="text-right md:shrink-0">
                        <span className="text-surya-400 font-semibold block">{eng.salary}</span>
                        <span className="text-xs text-gray-600 block">{eng.usd}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 6. Why Useful for India */}
              <section id="useful-for-india" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Landmark size={20} className="text-surya-500" />
                  6. Why This Is Useful for India
                </h2>
                <ul className="space-y-4 text-sm text-gray-400 list-disc pl-5 leading-relaxed">
                  <li>
                    <strong>Sovereignty & Security:</strong> Compliance with the <strong>DPDP Act 2023</strong> by keeping citizen, financial, and strategic data strictly within Indian regions (`ap-south-1`).
                  </li>
                  <li>
                    <strong>Incredible Affordability:</strong> Targeting ~252× cheaper serving costs than overseas options, enabling local start-ups, farmers, students, and citizens to access frontier AI.
                  </li>
                  <li>
                    <strong>Indic-First Architecture:</strong> Built-in native support for <strong>22 official Indian languages</strong> from day one, with BPE tokenizers tailored to lower translation overheads.
                  </li>
                  <li>
                    <strong>Economic Talents Anchor:</strong> Offers silicon-valley-quality salaries and research opportunities in Bangalore, keeping India&apos;s best minds working on domestic IP.
                  </li>
                </ul>
              </section>

              {/* 7. Achievable Expectations */}
              <section id="achievable-expectations" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <FileText size={20} className="text-surya-500" />
                  7. Is This Actually Achievable? (Honest Expectations)
                </h2>
                <p className="text-sm text-gray-500">
                  We are not selling vaporware. Here is what we realistically deliver on our budget:
                </p>

                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-surface-1/30">
                  <table className="min-w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="p-4 font-semibold text-white">Capability</th>
                        <th className="p-4 font-semibold text-white">Target Tier</th>
                        <th className="p-4 font-semibold text-white">Not Achievable on this Budget</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-400">
                      <tr>
                        <td className="p-4 font-medium text-white">Text Core & Reasoning</td>
                        <td className="p-4 text-green-400">Gemini-3.5-Flash / Sonnet-4.5 / Haiku-4.5 quality</td>
                        <td className="p-4">Claude-4-Opus tier from-scratch</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Image Generation</td>
                        <td className="p-4 text-green-400">Flux-dev / SDXL-Turbo quality LoRA</td>
                        <td className="p-4">Nano Banana / Midjourney v7 from-scratch</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Video Generation</td>
                        <td className="p-4 text-green-400">CogVideoX-5B fine-tuned LoRA</td>
                        <td className="p-4">Kling 3.0 / Sora from-scratch</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Indic Audio Stack</td>
                        <td className="p-4 text-green-400">ElevenLabs / Sarvam AI parity (TTS, voice clones)</td>
                        <td className="p-4">None — SOTA is achievable on open bases</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Search Grounding</td>
                        <td className="p-4 text-green-400">Perplexity Sonar quality factual answers</td>
                        <td className="p-4">Perplexity Pro multi-step deep research agent</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 8. Parallel Funding Tracks */}
              <section id="parallel-funding" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Landmark size={20} className="text-surya-500" />
                  8. Funding Sources We Are Pursuing in Parallel
                </h2>
                <div className="overflow-x-auto rounded-2xl border border-white/5 bg-surface-1/30">
                  <table className="min-w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="p-4 font-semibold text-white">Track</th>
                        <th className="p-4 font-semibold text-white">Type</th>
                        <th className="p-4 font-semibold text-white">Potential Size</th>
                        <th className="p-4 font-semibold text-white">Draft Application File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-400">
                      <tr>
                        <td className="p-4 font-medium text-white">Cloud Credit Grants</td>
                        <td className="p-4">0% dilution compute</td>
                        <td className="p-4 text-surya-400">~₹2 Crore – ₹3 Crore</td>
                        <td className="p-4 font-mono">30_cloud_credits_checklist.md</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">IndiaAI Mission (MeitY)</td>
                        <td className="p-4">Non-dilutive grant</td>
                        <td className="p-4 text-surya-400">Up to ₹2 Crore</td>
                        <td className="p-4 font-mono">20_indiaai_application.md</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Startup India Seed Fund</td>
                        <td className="p-4">Grant + Convertible</td>
                        <td className="p-4 text-surya-400">Up to ₹5.5 Crore</td>
                        <td className="p-4 font-mono">21_startup_india_seed.md</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">MeitY Samridh + TIDE</td>
                        <td className="p-4">Grant + match equity</td>
                        <td className="p-4 text-surya-400">~₹80 Lakh</td>
                        <td className="p-4 font-mono">23_meity_samridh.md</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">DST SERB CRG</td>
                        <td className="p-4">Academic partnership</td>
                        <td className="p-4 text-surya-400">₹30 Lakh – ₹2 Crore</td>
                        <td className="p-4 font-mono">22_dst_serb.md</td>
                      </tr>
                      <tr>
                        <td className="p-4 font-medium text-white">Corporate Strategic Licensing</td>
                        <td className="p-4">B2B anchor contracts</td>
                        <td className="p-4 text-surya-400">₹50 Lakh – ₹3 Crore</td>
                        <td className="p-4 font-mono">40_corp_outreach.md</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 9. Codebase Proof */}
              <section id="architecture-proof" className="scroll-mt-12 space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Code size={20} className="text-surya-500" />
                  9. Codebase Architecture (Proof of Build)
                </h2>
                <p className="text-sm text-gray-500">
                  Our codebase is fully scaffolded and passes test runs locally. Here is where the modules live:
                </p>

                <div className="space-y-4 text-xs leading-relaxed text-gray-400">
                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 space-y-2">
                    <strong className="text-white block text-sm">model/ (Core Architecture)</strong>
                    <p>Contains the three-branch sparse block design (<span className="text-surya-400">lighthouse_attn.py</span>), MoE routing logic (<span className="text-surya-400">moe.py</span>), agentic planning head (<span className="text-surya-400">agent_head.py</span>), and YaRN embeddings (<span className="text-surya-400">rope.py</span>).</p>
                  </div>
                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 space-y-2">
                    <strong className="text-white block text-sm">train/ (DeepSpeed Pipeline)</strong>
                    <p>Contains the Zero-3 training script (<span className="text-surya-400">pretrain.py</span>), the YaRN heal script (<span className="text-surya-400">heal.py</span>), and DPO/RL fine-tuning configurations (<span className="text-surya-400">dpo.py</span>, <span className="text-surya-400">rl_reasoning.py</span>).</p>
                  </div>
                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 space-y-2">
                    <strong className="text-white block text-sm">search/ (Grounding Index)</strong>
                    <p>Integrates SearXNG, Tavily, Brave, and R2 crawlers (<span className="text-surya-400">index.py</span>) with dedicated parsers for YouTube, GitHub, and arXiv links.</p>
                  </div>
                  <div className="p-6 rounded-2xl border border-white/5 bg-surface-1/30 space-y-2">
                    <strong className="text-white block text-sm">serve/ (Gateway Serving)</strong>
                    <p>FastAPI app routing tasks to specialized endpoints. Fully configured for AWQ 4-bit quantization and speculative decode acceleration.</p>
                  </div>
                </div>
              </section>

              {/* 10. Asks & Next Steps */}
              <section id="asks-next-steps" className="scroll-mt-12 space-y-6 border-t border-white/5 pt-12">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Shield size={20} className="text-surya-500" />
                  10. Asks & Next Steps
                </h2>
                <div className="p-6 rounded-2xl border border-surya-500/20 bg-surya-500/5 text-sm text-gray-400 space-y-4">
                  <p>
                    We are opening parallel conversations with cloud providers, VCs, and government grants. Your support in any category accelerates India&apos;s AI independence.
                  </p>
                  <p>
                    <strong>Immediate Action:</strong> We are hiring our core engineering team to lock the final capital requirement before launching Phase 3 training.
                  </p>
                  <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-6">
                    <div>
                      <span className="block text-xs text-gray-600 uppercase mb-1">Send Proposals to</span>
                      <strong className="text-white">pvshariharan324@gmail.com</strong>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-600 uppercase mb-1">Live Environment</span>
                      <a href="https://suryaai.in" className="text-surya-400 hover:underline font-semibold">
                        suryaai.in
                      </a>
                    </div>
                  </div>
                </div>
              </section>

            </article>
          </main>
        </div>
      </div>
    </div>
  );
}
