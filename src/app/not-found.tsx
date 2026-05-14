import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "404 — Page Not Found | Surya AI",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Big 404 */}
        <div className="space-y-2">
          <h1 className="text-7xl font-bold text-surya-500 tracking-tight">404</h1>
          <h2 className="text-xl font-semibold text-white">Page Not Found</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Don&apos;t worry — let&apos;s get you back on track.
          </p>
        </div>

        {/* Recovery CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/"
            aria-label="Go Home"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-surya-500 hover:bg-surya-700 text-white font-medium text-sm transition-colors"
          >
            <Home size={16} />
            Go Home
          </Link>
          <Link
            href="/chat"
            aria-label="Back to Dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:border-white/25 text-gray-300 hover:text-white font-medium text-sm transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>

        {/* Helpful links */}
        <div className="pt-6 border-t border-white/5 flex justify-center gap-5 text-xs text-gray-600">
          <Link href="/chat" className="hover:text-surya-500 transition-colors">Chat</Link>
          <Link href="/projects" className="hover:text-surya-500 transition-colors">Projects</Link>
          <Link href="/app-builder" className="hover:text-surya-500 transition-colors">App Builder</Link>
          <Link href="/privacy" className="hover:text-surya-500 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-surya-500 transition-colors">Terms</Link>
        </div>
      </div>
    </div>
  );
}
