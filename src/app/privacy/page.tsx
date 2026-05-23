import Link from "next/link";

import { pageMetadata } from "@/lib/seo";

export const metadata = {
  ...pageMetadata(
    "/privacy",
    "Privacy Policy",
    "Privacy Policy for Surya AI, including how data is collected, used, and protected."
  ),
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-gray-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <Link href="/" className="text-surya-500 text-sm hover:underline mb-8 inline-block">
          ← Back to Surya AI
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: April 29, 2026</p>

        <div className="space-y-8 text-sm leading-7">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Who We Are</h2>
            <p>
              Surya AI (<strong>suryaai.in</strong>) is an AI-powered assistant platform built for students
              and developers in India and worldwide. We are operated by Prabhas (pvshariharan324@gmail.com).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-gray-300">Account info:</strong> Name, email, profile picture — collected via Google or GitHub OAuth when you sign in.</li>
              <li><strong className="text-gray-300">Chat data:</strong> Messages and conversations you create are stored to provide the service.</li>
              <li><strong className="text-gray-300">Usage data:</strong> Pages visited, features used — for improving the product.</li>
              <li><strong className="text-gray-300">Files:</strong> Files you upload to Projects are stored securely and used only for your sessions.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>To provide and improve the Surya AI service.</li>
              <li>To authenticate you and keep your account secure.</li>
              <li>To process your chat messages through AI model providers (Anthropic, Google).</li>
              <li>To contact you about important service updates.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Data Sharing</h2>
            <p className="text-gray-400">
              We do <strong className="text-gray-300">not sell</strong> your personal data. We share data only with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-2">
              <li><strong className="text-gray-300">AI Providers:</strong> Your messages are sent to Anthropic (Claude) and Google (Gemini) to generate responses. Their privacy policies apply.</li>
              <li><strong className="text-gray-300">Infrastructure:</strong> Vercel (hosting), InsForge (database). These providers process data only to deliver our service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Google User Data</h2>
            <p className="text-gray-400">
              Surya AI uses Google OAuth to sign you in. We request only your basic profile (name, email, avatar).
              If you connect Google Workspace features (Gmail, Drive, Calendar), we access only the data you
              explicitly authorize — and only to perform the actions you request in the chat. We do not store
              your Google data beyond what is needed for your active session.
            </p>
            <p className="text-gray-400 mt-2">
              Our use of Google user data complies with the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-surya-500 hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Retention</h2>
            <p className="text-gray-400">
              Your conversations and account data are retained as long as your account is active.
              You can delete your account and all associated data at any time by contacting us at{" "}
              <a href="mailto:pvshariharan324@gmail.com" className="text-surya-500 hover:underline">
                pvshariharan324@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Cookies</h2>
            <p className="text-gray-400">
              We use session cookies for authentication only. We do not use third-party advertising cookies
              or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights</h2>
            <p className="text-gray-400">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-gray-400 mt-2">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and data.</li>
              <li>Withdraw consent for data processing at any time.</li>
            </ul>
            <p className="text-gray-400 mt-2">
              Email us at{" "}
              <a href="mailto:pvshariharan324@gmail.com" className="text-surya-500 hover:underline">
                pvshariharan324@gmail.com
              </a>{" "}
              to exercise any of these rights.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Security</h2>
            <p className="text-gray-400">
              We use HTTPS, encrypted storage, and industry-standard security practices to protect your data.
              No system is 100% secure — if you discover a vulnerability, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p className="text-gray-400">
              We may update this policy periodically. We will notify you of significant changes via email
              or a notice on the platform. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contact</h2>
            <p className="text-gray-400">
              Questions about this policy? Contact:{" "}
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
