"use client";


import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Palette, Bot, Save, Plug, ArrowLeft, LogOut, Brain, Trash2 } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectorCard } from "@/components/connectors/ConnectorCard";

interface ConnectorStatus {
  google: { connected: boolean; email?: string; expiresAt?: string };
  github: { connected: boolean };
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saved, setSaved] = useState(false);
  const [connectorToast, setConnectorToast] = useState<string | null>(null);

  // Show feedback after returning from Google Workspace OAuth
  useEffect(() => {
    const workspaceConnected = searchParams.get("workspace_connected");
    const connectorError = searchParams.get("connector_error");
    if (workspaceConnected === "1") {
      setConnectorToast("Google Workspace connected!");
      refreshConnectorStatus(); // Refresh badge immediately
      router.replace("/settings");
    } else if (connectorError) {
      setConnectorToast(`Connection failed: ${connectorError.replace(/_/g, " ")}`);
      router.replace("/settings");
    }
  }, [searchParams, router]);

  const [profile, setProfile] = useState({
    name: "",
    role: "",
    bio: "",
    website: "",
  });

  const [preferences, setPreferences] = useState({
    responseStyle: "balanced",
    defaultModel: "sonnet",
    language: "English",
  });

  // Hydrate profile + preferences from server
  useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setProfile({
          name: data.name ?? "",
          role: data.role ?? "",
          bio: data.bio ?? "",
          website: data.website ?? "",
        });
        if (data.preferences) {
          setPreferences({
            responseStyle: data.preferences.responseStyle ?? "balanced",
            defaultModel: data.preferences.defaultModel ?? "sonnet",
            language: data.preferences.language ?? "English",
          });
        }
      })
      .catch(() => {});
  }, []);

  // Connector state
  const [connectorStatus, setConnectorStatus] = useState<ConnectorStatus | null>(null);
  const [connectorLoading, setConnectorLoading] = useState<{ google: boolean; github: boolean }>({
    google: false,
    github: false,
  });

  const refreshConnectorStatus = () => {
    fetch("/api/connectors/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setConnectorStatus(data); })
      .catch(() => {});
  };

  useEffect(() => {
    refreshConnectorStatus();
  }, []);

  // Memory state — ChatGPT-style persistent memories
  const [memories, setMemories] = useState<Array<{ id: string; content: string }>>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.memories) setMemories(d.memories);
      })
      .catch(() => {})
      .finally(() => setMemoriesLoading(false));
  }, []);

  async function deleteMemory(id: string) {
    setMemories((s) => s.filter((m) => m.id !== id));
    try {
      await fetch(`/api/memory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // best-effort — refetch on failure
      fetch("/api/memory").then((r) => r.json()).then((d) => d?.memories && setMemories(d.memories)).catch(() => {});
    }
  }

  async function handleConnect(provider: "google" | "github") {
    setConnectorLoading((s) => ({ ...s, [provider]: true }));
    if (provider === "google") {
      // Google Workspace connector — dedicated OAuth flow that requests
      // workspace scopes (Gmail, Drive, Calendar, Docs) separately from login.
      // Stored as "google-workspace" in connector_tokens, never overwritten by
      // the basic login flow.
      window.location.href = "/api/connectors/google/connect";
    } else {
      await signIn(provider);
      // signIn redirects — loading state cleared on return
    }
  }

  async function handleDisconnect(provider: "google" | "github") {
    setConnectorLoading((s) => ({ ...s, [provider]: true }));
    // Optimistic update
    setConnectorStatus((s) =>
      s ? { ...s, [provider]: { connected: false } } : s
    );
    try {
      const res = await fetch(`/api/connectors/disconnect?provider=${provider}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Revert on failure
        const statusRes = await fetch("/api/connectors/status");
        if (statusRes.ok) setConnectorStatus(await statusRes.json());
      }
    } finally {
      setConnectorLoading((s) => ({ ...s, [provider]: false }));
    }
  }

  async function handleSave() {
    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, preferences }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error("[settings] save failed:", err);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Connector toast notification */}
      {connectorToast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all
            ${connectorToast.startsWith("Google Workspace connected")
              ? "bg-emerald-500 text-white"
              : "bg-red-500/90 text-white"}`}
          onClick={() => setConnectorToast(null)}
        >
          {connectorToast}
        </div>
      )}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/chat")}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
              title="Back to chat"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">Settings</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your profile and preferences</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut size={14} />
            Logout
          </Button>
        </div>

        {/* Personal Information */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <User size={14} />
            Personal Information
          </div>
          <div className="bg-surface-1 border border-white/8 rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Full Name</label>
                <Input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="bg-surface-2 border-white/10 text-white text-sm h-9"
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-400">Role / Title</label>
                <Input
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                  className="bg-surface-2 border-white/10 text-white text-sm h-9"
                  placeholder="e.g. Developer, Researcher"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Website / Portfolio</label>
              <Input
                value={profile.website}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                className="bg-surface-2 border-white/10 text-white text-sm h-9"
                placeholder="https://yoursite.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Bio (used to personalize responses)</label>
              <Textarea
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                className="bg-surface-2 border-white/10 text-white text-sm resize-none"
                rows={3}
                placeholder="Tell Surya AI about yourself so it can personalize responses..."
              />
            </div>
          </div>
        </section>

        {/* AI Preferences */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Bot size={14} />
            AI Preferences
          </div>
          <div className="bg-surface-1 border border-white/8 rounded-xl p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Default Model</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "sonnet", label: "Sonnet 4.6", desc: "Fast & smart (default)" },
                  { key: "opus", label: "Opus 4.6", desc: "Deep Thinking tasks" },
                ].map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setPreferences({ ...preferences, defaultModel: m.key })}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      preferences.defaultModel === m.key
                        ? "border-surya-500 bg-surya-500/10 text-white"
                        : "border-white/10 bg-surface-2 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <p className="text-xs font-medium">{m.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-400">Response Style</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "concise", label: "Concise", desc: "Short & direct" },
                  { key: "balanced", label: "Balanced", desc: "Clear & complete" },
                  { key: "detailed", label: "Detailed", desc: "Thorough & deep" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setPreferences({ ...preferences, responseStyle: s.key })}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      preferences.responseStyle === s.key
                        ? "border-surya-500 bg-surya-500/10 text-white"
                        : "border-white/10 bg-surface-2 text-gray-400 hover:border-white/20"
                    }`}
                  >
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Connected Accounts */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Plug size={14} />
            Connected Accounts
          </div>
          <div className="space-y-3">
            {!connectorStatus ? (
              <>
                <Skeleton className="h-[88px] rounded-xl" />
                <Skeleton className="h-[60px] rounded-xl" />
              </>
            ) : (
              <>
                <ConnectorCard
                  provider="google"
                  connected={connectorStatus.google.connected}
                  email={connectorStatus.google.email}
                  expiresAt={connectorStatus.google.expiresAt}
                  onConnect={() => handleConnect("google")}
                  onDisconnect={() => handleDisconnect("google")}
                  isLoading={connectorLoading.google}
                />
                <ConnectorCard
                  provider="github"
                  connected={connectorStatus.github.connected}
                  onConnect={() => handleConnect("github")}
                  onDisconnect={() => handleDisconnect("github")}
                  isLoading={connectorLoading.github}
                />
              </>
            )}
          </div>
          <p className="text-xs text-gray-600">
            Connect accounts to let Surya AI access Gmail, Drive, Calendar, Docs, and GitHub on your behalf.
            Enable the{" "}
            <span className="inline-flex items-center gap-0.5 text-gray-500">
              <Plug size={10} /> connector toggle
            </span>{" "}
            in the chat input to activate workspace tools.
          </p>
        </section>

        {/* Memory — ChatGPT-style persistent memory */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Brain size={14} />
            Memory
          </div>
          <div className="bg-surface-1 border border-white/8 rounded-xl p-5 space-y-3">
            {memoriesLoading ? (
              <Skeleton className="h-12 w-full rounded-lg" />
            ) : memories.length === 0 ? (
              <p className="text-xs text-gray-500">
                No memories yet. Tell Surya AI things like &ldquo;remember I prefer dark mode&rdquo; or &ldquo;remember I work at Acme&rdquo; and they&apos;ll persist across all chats.
              </p>
            ) : (
              <ul className="space-y-2">
                {memories.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start justify-between gap-3 text-sm bg-surface-2 border border-white/8 rounded-lg px-3 py-2"
                  >
                    <span className="text-gray-300 break-words flex-1 min-w-0">{m.content}</span>
                    <button
                      type="button"
                      onClick={() => deleteMemory(m.id)}
                      title="Delete memory"
                      className="text-gray-500 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-gray-600">
            Surya AI remembers facts you share so it can personalize replies across conversations. Delete any memory anytime.
          </p>
        </section>

        {/* Creator Info */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
            <Palette size={14} />
            About Surya AI
          </div>
          <div className="bg-surface-1 border border-white/8 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surya-500/10 border border-surya-500/20 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Surya AI" className="w-6 h-6 rounded-sm" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Surya AI</p>
                <p className="text-xs text-gray-500">The AI that thinks with you</p>
              </div>
            </div>

            <p className="text-xs text-gray-500 border-t border-white/6 pt-4">
              Surya AI is a production-grade AI assistant. It helps you write code, answer questions, analyze data, build apps, and automate your work.
            </p>
          </div>
        </section>

        {/* Save */}
        <div className="flex justify-end pb-4">
          <Button
            onClick={handleSave}
            className="bg-surya-500 hover:bg-surya-700 text-white gap-2"
          >
            <Save size={14} />
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}