import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Surya AI",
  description: "Terms of Service for Surya AI — rules for using the platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <Link href="/" className="text-surya-500 text-sm hover:underline mb-8 inline-block">
          ← Back to Surya AI
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: April 29, 2026</p>

        <div className="space-y-8 text-sm leading-7">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p className="text-gray-400">
              By accessing or using Surya AI (<strong className="text-gray-300">suryaai.in</strong>),
              you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p className="text-gray-400">
              Surya AI is an AI-powered assistant platform providing chat, research, code generation,
              app building, and related features powered by large language models including Claude (Anthropic)
              and Gemini (Google).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Eligibility</h2>
            <p className="text-gray-400">
              You must be at least 13 years old to use Surya AI. By using the service, you represent
              that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Acceptable Use</h2>
            <p className="text-gray-400">You agree not to use Surya AI to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-2">
              <li>Generate illegal, harmful, or abusive content.</li>
              <li>Violate any applicable laws or regulations.</li>
              <li>Infringe intellectual property rights of others.</li>
              <li>Attempt to reverse-engineer, scrape, or abuse the platform.</li>
              <li>Use the service to harm, harass, or deceive other people.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Intellectual Property</h2>
            <p className="text-gray-400">
              Surya AI and its original content, features, and functionality are owned by Prabhas and
              protected under applicable intellectual property laws. AI-generated outputs are provided
              as-is and ownership follows the terms of the underlying model providers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Disclaimer of Warranties</h2>
            <p className="text-gray-400">
              Surya AI is provided <strong className="text-gray-300">&quot;as is&quot;</strong> without warranties
              of any kind. AI responses may be inaccurate, incomplete, or outdated. Do not rely solely
              on AI outputs for critical decisions including medical, legal, or financial matters.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Limitation of Liability</h2>
            <p className="text-gray-400">
              To the maximum extent permitted by law, Surya AI and its operators shall not be liable
              for any indirect, incidental, special, or consequential damages arising from your use
              of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Modifications</h2>
            <p className="text-gray-400">
              We reserve the right to modify or discontinue the service at any time. We may update
              these terms — continued use after changes means you accept the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Governing Law</h2>
            <p className="text-gray-400">
              These terms are governed by the laws of India. Any disputes shall be resolved in the
              courts of India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Contact</h2>
            <p className="text-gray-400">
              Questions about these terms? Contact:{" "}
              <a href="mailto:pvshariharan324@gmail.com" className="text-surya-500 hover:underline">
                pvshariharan324@gmail.com
              </a>
            </p>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/5 flex gap-6 text-xs text-gray-600">
          <Link href="/" className="hover:text-surya-500">Home</Link>
          <Link href="/privacy" className="hover:text-surya-500">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-surya-500">Terms of Service</Link>
          <span>© 2026 Surya AI</span>
        </div>
      </div>
    </div>
  );
}
