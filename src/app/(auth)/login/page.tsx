"use client";

import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Separate component so useSearchParams is inside its own Suspense boundary
function ErrorBanner() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const errorCode = searchParams.get("error");
  const linkedProvider = searchParams.get("provider");

  // If ProviderLinked error and old session still active → sign out silently
  useEffect(() => {
    if (errorCode === "ProviderLinked" && session?.user) {
      signOut({ redirect: false });
    }
  }, [errorCode, session]);

  if (!errorCode) return null;

  const message =
    errorCode === "ProviderLinked" && linkedProvider
      ? `This email is already linked to ${linkedProvider === "github" ? "GitHub" : "Google"}. Please sign in with ${linkedProvider === "github" ? "GitHub" : "Google"} instead.`
      : errorCode === "OAuthSignin" || errorCode === "OAuthCallback"
      ? "OAuth sign-in failed. Please try again."
      : "Sign-in failed. Please try again.";

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-4 text-sm"
      style={{
        background: "rgba(239,68,68,0.1)",
        border: "1px solid rgba(239,68,68,0.25)",
        color: "rgba(252,165,165,0.9)",
      }}
    >
      <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
      <span>{message}</span>
    </motion.div>
  );
}

export default function LoginPage() {
  const [loadingProvider, setLoadingProvider] = useState<
    "google" | "github" | null
  >(null);

  async function handleSignIn(provider: "google" | "github") {
    setLoadingProvider(provider);
    await signIn(provider, { callbackUrl: "/chat" });
    setLoadingProvider(null);
  }

  const isLoading = loadingProvider !== null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            "radial-gradient(ellipse at 50% 50%, rgba(26,115,232,0.07) 0%, transparent 65%)",
            "radial-gradient(ellipse at 50% 42%, rgba(26,115,232,0.11) 0%, transparent 65%)",
            "radial-gradient(ellipse at 50% 50%, rgba(26,115,232,0.07) 0%, transparent 65%)",
          ],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm mx-4"
      >
        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl border"
          style={{
            background: "var(--surface-1, #1A1D27)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          {/* Logo + wordmark */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden"
              style={{
                boxShadow: "0 8px 32px rgba(26,115,232,0.35)",
              }}
            >
              <Image
                src="/logo.png"
                alt="Surya AI"
                width={56}
                height={56}
                priority
                className="w-full h-full object-cover"
              />
            </motion.div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Surya AI</h1>
            <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              The AI that thinks with you
            </p>
          </div>

          {/* Error banner — Suspense so useSearchParams doesn't break SSR */}
          <Suspense fallback={null}>
            <ErrorBanner />
          </Suspense>

          {/* Auth buttons */}
          <div className="flex flex-col gap-3">
            {/* Google */}
            <Button
              onClick={() => handleSignIn("google")}
              disabled={isLoading}
              className="w-full h-11 font-medium rounded-xl text-white border-0 transition-all duration-200 flex items-center justify-center gap-2.5"
              style={{
                background:
                  isLoading && loadingProvider === "google"
                    ? "rgba(26,115,232,0.7)"
                    : "linear-gradient(135deg, #1A73E8 0%, #1557B0 100%)",
                boxShadow: "0 4px 16px rgba(26,115,232,0.25)",
              }}
            >
              {loadingProvider === "google" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {loadingProvider === "google" ? "Connecting..." : "Continue with Google"}
            </Button>

            {/* GitHub */}
            <Button
              onClick={() => handleSignIn("github")}
              disabled={isLoading}
              variant="outline"
              className="w-full h-11 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.85)",
              }}
            >
              {loadingProvider === "github" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              )}
              {loadingProvider === "github" ? "Connecting..." : "Continue with GitHub"}
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              secure OAuth login
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Legal */}
          <p className="text-center text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
            By continuing, you agree to Surya AI&apos;s{" "}
            <a href="/terms" className="hover:underline" style={{ color: "rgba(26,115,232,0.8)" }}>Terms</a>{" "}
            and{" "}
            <a href="/privacy" className="hover:underline" style={{ color: "rgba(26,115,232,0.8)" }}>Privacy Policy</a>.
          </p>
        </div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-center text-xs mt-4"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          Free to start · No credit card required
        </motion.p>
      </motion.div>
    </div>
  );
}
