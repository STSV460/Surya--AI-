"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, Lock, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";

type AuthMode = "signin" | "signup";
type EmailStatus =
  | { type: "idle"; message: "" }
  | { type: "success" | "error" | "info"; message: string };

const PENDING_EMAIL_LOGIN_KEY = "surya.pendingEmailLogin";
const PENDING_EMAIL_LOGIN_TTL_MS = 10 * 60 * 1000;

function StatusBanner({
  status,
  className = "",
}: {
  status: EmailStatus;
  className?: string;
}) {
  if (status.type === "idle") return null;

  const isError = status.type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${className}`}
      style={{
        background: isError ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
        border: `1px solid ${isError ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.25)"}`,
        color: isError ? "rgba(252,165,165,0.95)" : "rgba(134,239,172,0.95)",
      }}
    >
      <Icon size={16} className="shrink-0 mt-0.5" />
      <span>{status.message}</span>
    </motion.div>
  );
}

function ErrorBanner() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const errorCode = searchParams.get("error");
  const linkedProvider = searchParams.get("provider");
  const verified = searchParams.get("verified");
  const insforgeStatus = searchParams.get("insforge_status");
  const insforgeType = searchParams.get("insforge_type");
  const insforgeError = searchParams.get("insforge_error");

  useEffect(() => {
    if (errorCode === "ProviderLinked" && session?.user) {
      signOut({ redirect: false });
    }
  }, [errorCode, session]);

  if (verified === "1" || (insforgeStatus === "success" && insforgeType === "verify_email")) {
    return (
      <StatusBanner
        className="mb-4"
        status={{ type: "success", message: "Email verified. Sign in to continue." }}
      />
    );
  }

  if (insforgeStatus === "error" && insforgeType === "verify_email") {
    return (
      <StatusBanner
        className="mb-4"
        status={{
          type: "error",
          message: insforgeError
            ? `Email verification failed: ${insforgeError}`
            : "Email verification failed. Try resending the verification email.",
        }}
      />
    );
  }

  if (!errorCode) return null;

  const message =
    errorCode === "ProviderLinked" && linkedProvider
      ? `This email is already linked to ${linkedProvider === "github" ? "GitHub" : "Google"}. Please sign in with ${linkedProvider === "github" ? "GitHub" : "Google"} instead.`
      : errorCode === "OAuthSignin" || errorCode === "OAuthCallback"
      ? "OAuth sign-in failed. Please try again."
      : errorCode === "CredentialsSignin"
      ? "Email or password is incorrect, or email verification is still pending."
      : "Sign-in failed. Please try again.";

  return <StatusBanner className="mb-4" status={{ type: "error", message }} />;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoLoginAttempted = useRef(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loadingProvider, setLoadingProvider] = useState<"google" | "github" | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ type: "idle", message: "" });
  const [showOtp, setShowOtp] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    otp: "",
  });

  const isLoading = loadingProvider !== null || emailLoading || verifyLoading;
  const title = mode === "signin" ? "Welcome back" : "Create account";
  const emailButtonLabel = useMemo(() => {
    if (emailLoading) return mode === "signin" ? "Signing in..." : "Creating...";
    return mode === "signin" ? "Continue with Email" : "Create with Email";
  }, [emailLoading, mode]);

  useEffect(() => {
    const verified =
      searchParams.get("verified") === "1" ||
      (searchParams.get("insforge_status") === "success" &&
        searchParams.get("insforge_type") === "verify_email");

    if (!verified) return;

    async function finishVerifiedLogin() {
      setMode("signin");
      setShowOtp(false);

      if (autoLoginAttempted.current) return;
      autoLoginAttempted.current = true;

      const pendingRaw = sessionStorage.getItem(PENDING_EMAIL_LOGIN_KEY);
      if (!pendingRaw) {
        setEmailStatus({ type: "success", message: "Email verified. Sign in to continue." });
        setForm((prev) => ({ ...prev, password: "", otp: "" }));
        return;
      }

      try {
        const pending = JSON.parse(pendingRaw) as {
          email?: string;
          password?: string;
          createdAt?: number;
        };
        const isFresh =
          typeof pending.createdAt === "number" &&
          Date.now() - pending.createdAt <= PENDING_EMAIL_LOGIN_TTL_MS;

        if (!pending.email || !pending.password || !isFresh) {
          sessionStorage.removeItem(PENDING_EMAIL_LOGIN_KEY);
          setEmailStatus({ type: "success", message: "Email verified. Sign in to continue." });
          setForm((prev) => ({ ...prev, password: "", otp: "" }));
          return;
        }

        setEmailLoading(true);
        setEmailStatus({ type: "info", message: "Email verified. Signing you in..." });
        const result = await signIn("credentials", {
          email: pending.email,
          password: pending.password,
          redirect: false,
        });

        sessionStorage.removeItem(PENDING_EMAIL_LOGIN_KEY);

        if (result?.error) {
          setEmailStatus({ type: "success", message: "Email verified. Sign in to continue." });
          setForm((prev) => ({ ...prev, email: pending.email ?? prev.email, password: "", otp: "" }));
          return;
        }

        router.push("/chat");
        router.refresh();
      } catch {
        sessionStorage.removeItem(PENDING_EMAIL_LOGIN_KEY);
        setEmailStatus({ type: "success", message: "Email verified. Sign in to continue." });
        setForm((prev) => ({ ...prev, password: "", otp: "" }));
      } finally {
        setEmailLoading(false);
      }
    }

    void finishVerifiedLogin();
  }, [router, searchParams]);

  async function handleOAuthSignIn(provider: "google" | "github") {
    setLoadingProvider(provider);
    await signIn(provider, { callbackUrl: "/chat" });
    setLoadingProvider(null);
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailLoading(true);
    setEmailStatus({ type: "idle", message: "" });

    const email = form.email.trim().toLowerCase();

    try {
      if (mode === "signin") {
        const result = await signIn("credentials", {
          email,
          password: form.password,
          redirect: false,
        });

        if (result?.error) {
          setEmailStatus({
            type: "error",
            message: "Email or password is incorrect, or email verification is still pending.",
          });
          return;
        }

        router.push("/chat");
        router.refresh();
        return;
      }

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          email,
          password: form.password,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        requireEmailVerification?: boolean;
        verifyEmailMethod?: "code" | "link";
      };

      if (!response.ok) {
        setEmailStatus({ type: "error", message: data.error ?? "Could not create account." });
        return;
      }

      if (data.requireEmailVerification) {
        const isCode = data.verifyEmailMethod === "code";
        setShowOtp(isCode);
        if (!isCode) {
          sessionStorage.setItem(
            PENDING_EMAIL_LOGIN_KEY,
            JSON.stringify({ email, password: form.password, createdAt: Date.now() })
          );
        }
        setEmailStatus({
          type: "success",
          message: isCode
            ? "Verification code sent. Enter it below."
            : "Verification email sent. Open the link, then sign in.",
        });
        return;
      }

      setEmailStatus({ type: "success", message: "Account created. Sign in to continue." });
      sessionStorage.setItem(
        PENDING_EMAIL_LOGIN_KEY,
        JSON.stringify({ email, password: form.password, createdAt: Date.now() })
      );
      setMode("signin");
    } catch (error) {
      setEmailStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Email auth failed.",
      });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleVerifyEmail() {
    setVerifyLoading(true);
    setEmailStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          otp: form.otp.trim(),
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setEmailStatus({ type: "error", message: data.error ?? "Verification failed." });
        return;
      }

      setShowOtp(false);
      setMode("signin");
      setEmailStatus({ type: "success", message: "Email verified. Sign in to continue." });
    } finally {
      setVerifyLoading(false);
    }
  }

  async function handleResend() {
    setEmailLoading(true);
    setEmailStatus({ type: "idle", message: "" });

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
      });
      const data = (await response.json()) as { error?: string };

      setEmailStatus(
        response.ok
          ? { type: "success", message: "Verification email sent again." }
          : { type: "error", message: data.error ?? "Could not resend verification email." }
      );
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden px-4 py-8">
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
        className="relative z-10 w-full max-w-sm"
      >
        <div
          className="rounded-2xl p-6 sm:p-8 shadow-2xl border"
          style={{
            background: "var(--surface-1, #1A1D27)",
            borderColor: "rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex flex-col items-center mb-6">
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
                src="/logo.png?v=surya-auth"
                alt="Surya AI"
                width={56}
                height={56}
                priority
                unoptimized
                className="w-full h-full object-cover"
              />
            </motion.div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Surya AI</h1>
            <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
              {title}
            </p>
          </div>

          <Suspense fallback={null}>
            <ErrorBanner />
          </Suspense>
          <StatusBanner className="mb-4" status={emailStatus} />

          <form className="flex flex-col gap-3" onSubmit={handleEmailSubmit}>
            {mode === "signup" && (
              <label className="relative block">
                <User
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Name"
                  autoComplete="name"
                  className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 pl-10 pr-3 text-sm text-white outline-none transition focus:border-[#1A73E8]/60"
                />
              </label>
            )}

            <label className="relative block">
              <Mail
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Email"
                type="email"
                autoComplete="email"
                required
                className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 pl-10 pr-3 text-sm text-white outline-none transition focus:border-[#1A73E8]/60"
              />
            </label>

            <label className="relative block">
              <Lock
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={8}
                required
                className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 pl-10 pr-3 text-sm text-white outline-none transition focus:border-[#1A73E8]/60"
              />
            </label>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 font-medium rounded-xl text-white border-0 transition-all duration-200 flex items-center justify-center gap-2.5"
              style={{
                background: emailLoading
                  ? "rgba(26,115,232,0.7)"
                  : "linear-gradient(135deg, #1A73E8 0%, #1557B0 100%)",
                boxShadow: "0 4px 16px rgba(26,115,232,0.25)",
              }}
            >
              {emailLoading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
              {emailButtonLabel}
            </Button>
          </form>

          {showOtp && (
            <div className="mt-3 flex flex-col gap-3">
              <input
                value={form.otp}
                onChange={(event) => setForm((prev) => ({ ...prev, otp: event.target.value }))}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 px-3 text-center text-sm text-white outline-none transition focus:border-[#1A73E8]/60"
              />
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  disabled={isLoading || form.otp.trim().length !== 6}
                  onClick={handleVerifyEmail}
                  className="h-10 rounded-xl"
                >
                  {verifyLoading ? <Loader2 size={16} className="animate-spin" /> : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={handleResend}
                  className="h-10 rounded-xl bg-white/[0.04] border-white/10 text-white/80"
                >
                  Resend
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              or
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleOAuthSignIn("google")}
              disabled={isLoading}
              variant="outline"
              className="w-full h-11 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 bg-white/[0.04] border-white/10 text-white/85"
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

            <Button
              onClick={() => handleOAuthSignIn("github")}
              disabled={isLoading}
              variant="outline"
              className="w-full h-11 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2.5 bg-white/[0.04] border-white/10 text-white/85"
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

          <button
            type="button"
            onClick={() => {
              setMode((prev) => (prev === "signin" ? "signup" : "signin"));
              setEmailStatus({ type: "idle", message: "" });
              setShowOtp(false);
            }}
            className="w-full mt-5 text-sm text-white/55 hover:text-white transition"
          >
            {mode === "signin" ? "New to Surya AI? Create account" : "Already have an account? Sign in"}
          </button>

          <p
            className="text-center text-xs leading-relaxed mt-5"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            By continuing, you agree to Surya AI&apos;s{" "}
            <a href="/terms" className="hover:underline" style={{ color: "rgba(26,115,232,0.8)" }}>
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="hover:underline" style={{ color: "rgba(26,115,232,0.8)" }}>
              Privacy Policy
            </a>
            .
          </p>
        </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
