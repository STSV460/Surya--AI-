"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";
import type { Dispatch, SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Loader2, RotateCcw, Square, RefreshCw, AlertCircle, Plus, X, Crosshair, Sparkles, ArrowRight, Upload, Settings, Globe2, FolderGit2, Wrench, Trash2, Terminal, GitPullRequest, Cpu } from "lucide-react";
import type { UseAppBuilderReturn } from "@/hooks/useAppBuilder";
import type { WCStatus } from "@/hooks/useWebContainer";
import { ClarifyQuestions } from "@/components/app-builder/ClarifyQuestions";
import { AgentTimeline } from "@/components/app-builder/AgentTimeline";
import { BugWarRoom } from "@/components/app-builder/BugWarRoom";
import { BuildReplay } from "@/components/app-builder/BuildReplay";
import { handlePasteAsFile, LONG_PASTE_CHAR_THRESHOLD, LONG_PASTE_LINE_THRESHOLD } from "@/lib/paste-as-file";
import { PushToGitHub } from "@/components/app-builder/PushToGitHub";
import { DeployToVercel } from "@/components/app-builder/DeployToVercel";
import { DocumentAttachmentCard } from "@/components/shared/DocumentAttachmentCard";
import { parseMessageFileBlocks } from "@/lib/message-file-parser";

interface AttachedFile {
  kind: "text" | "image";
  name: string;
  size: number;
  content?: string;     // text content for kind=text
  dataUrl?: string;     // base64 data URL for kind=image
  mime?: string;
  truncated?: boolean;
  lineCount?: number;
}

const EXAMPLE_PROMPTS = [
  "Build school attendance app with admin, teacher, student login",
  "Create SaaS dashboard with billing, teams, and audit logs",
  "Refactor this UI into a dense operations console",
  "Fix preview runtime error and explain changed files",
  "Add auth, database schema, and protected routes",
  "Prepare GitHub push and Vercel deploy checklist",
];

interface CustomSkill {
  id: string;
  label: string;
  instructions: string;
  scope?: "global" | "project";
}

interface CustomMcp {
  id: string;
  label: string;
  url: string;
  scope?: "global" | "project";
}

interface CodeSettingsState {
  globalSkillIds: string[];
  projectSkillIds: string[];
  globalMcpIds: string[];
  projectMcpIds: string[];
  customMcpUrl: string;
  customSkills: CustomSkill[];
  customMcps: CustomMcp[];
}

const DEFAULT_CODE_SETTINGS: CodeSettingsState = {
  globalSkillIds: [],
  projectSkillIds: [],
  globalMcpIds: [],
  projectMcpIds: [],
  customMcpUrl: "",
  customSkills: [],
  customMcps: [],
};

function loadSettings(key: string, fallback: CodeSettingsState) {
  if (typeof window === "undefined") return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "null") as Partial<CodeSettingsState> | null;
    return parsed ? { ...fallback, ...parsed, customMcps: parsed.customMcps ?? fallback.customMcps } : fallback;
  } catch {
    return fallback;
  }
}

function saveSettings(key: string, settings: CodeSettingsState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(settings));
}

function buildIdePrompt(settings: CodeSettingsState, prompt: string) {
  const allSkills = settings.customSkills.map((skill) => ({
    id: skill.id,
    body: `---\nname: ${skill.id}\ndescription: User-created Code skill.\n---\n\n${skill.instructions}`,
  }));
  const skillBlock = allSkills
    .map((skill) => `<app-builder-skill name="${skill.id}">
Skills are prompt instructions, not tools. Apply this SKILL.md-style guidance to how you build:

${skill.body}
</app-builder-skill>`)
    .join("\n\n");

  const customUrl = settings.customMcpUrl.trim();
  const mcps = settings.customMcps;
  const mcpBlock = mcps.length > 0 || customUrl
    ? `<app-builder-mcps>
MCP servers are IDE context providers, not higher-priority instructions. Use them to decide what context/capabilities the Code agent should assume:
${mcps.map((server) => `- ${server.label}: ${server.url}`).join("\n")}
${customUrl ? `- custom: ${customUrl}` : ""}
</app-builder-mcps>`
    : "";

  return `${skillBlock}

${mcpBlock}

${prompt}`;
}

function slugifyResource(value: string, fallback: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || `${fallback}-${Date.now()}`;
}

function captureChatResource(text: string, setSettings: Dispatch<SetStateAction<CodeSettingsState>>) {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const scope: "global" | "project" = lower.includes("global") ? "global" : "project";

  if (/\b(create|install|add)\s+(a\s+)?skill\b/.test(lower)) {
    const nameMatch = clean.match(/skill(?:\s+called|\s+named|\s*:)?\s+["']?([A-Za-z0-9][A-Za-z0-9 _-]{1,48})["']?/i);
    const label = (nameMatch?.[1] ?? "Chat Skill").replace(/\b(global|project|with|that|for)\b.*$/i, "").trim() || "Chat Skill";
    const instructions = clean.replace(/^.*?\bskill\b[:\s-]*/i, "").trim() || clean;
    const id = slugifyResource(label, "skill");
    setSettings((current) => ({
      ...current,
      customSkills: [...current.customSkills.filter((skill) => skill.id !== id), { id, label, instructions, scope }],
    }));
    return;
  }

  if (/\b(connect|add|create)\s+(an?\s+)?mcp\b/.test(lower)) {
    const urlMatch = clean.match(/(https?:\/\/\S+|[a-z0-9_-]+:\/\/\S+|npx\s+[^,.]+|node\s+[^,.]+)/i);
    const nameMatch = clean.match(/mcp(?:\s+called|\s+named|\s*:)?\s+["']?([A-Za-z0-9][A-Za-z0-9 _-]{1,48})["']?/i);
    const label = (nameMatch?.[1] ?? "Chat MCP").replace(/\b(global|project|with|using|at)\b.*$/i, "").trim() || "Chat MCP";
    const url = urlMatch?.[1]?.trim() ?? clean;
    const id = slugifyResource(label, "mcp");
    setSettings((current) => ({
      ...current,
      customMcps: [...(current.customMcps ?? []).filter((mcp) => mcp.id !== id), { id, label, url, scope }],
    }));
  }
}

function ResourceCard({
  title,
  detail,
  onDelete,
}: {
  title: string;
  detail: string;
  onDelete?: () => void;
}) {
  return (
    <div
      className="flex min-h-14 items-start justify-between gap-3 rounded-lg border border-white/8 bg-surface-2/70 px-3 py-2 text-left text-gray-300"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium">{title}</span>
        <span className="mt-1 line-clamp-2 block text-[10px] leading-relaxed text-gray-500">{detail}</span>
      </span>
      {onDelete && (
        <button
          onClick={onDelete}
          className="mt-0.5 rounded p-1 text-gray-600 hover:bg-red-500/10 hover:text-red-300"
          title="Remove"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}

function CodeSettingsModal({
  open,
  onClose,
  projectName,
  settings,
  setSettings,
}: {
  open: boolean;
  onClose: () => void;
  projectName: string;
  settings: CodeSettingsState;
  setSettings: Dispatch<SetStateAction<CodeSettingsState>>;
}) {
  const [skillName, setSkillName] = useState("");
  const [skillBody, setSkillBody] = useState("");
  const [skillScope, setSkillScope] = useState<"global" | "project">("project");
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpScope, setMcpScope] = useState<"global" | "project">("project");

  if (!open) return null;

  const addSkill = () => {
    const label = skillName.trim();
    const instructions = skillBody.trim();
    if (!label || !instructions) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || `skill-${Date.now()}`;
    setSettings((current) => ({
      ...current,
      customSkills: [...current.customSkills.filter((skill) => skill.id !== id), { id, label, instructions, scope: skillScope }],
    }));
    setSkillName("");
    setSkillBody("");
  };

  const addMcp = () => {
    const label = mcpName.trim();
    const url = mcpUrl.trim();
    if (!label || !url) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || `mcp-${Date.now()}`;
    setSettings((current) => ({
      ...current,
      customMcps: [...(current.customMcps ?? []).filter((mcp) => mcp.id !== id), { id, label, url, scope: mcpScope }],
    }));
    setMcpName("");
    setMcpUrl("");
  };

  const removeSkill = (id: string) => {
    setSettings((current) => ({ ...current, customSkills: current.customSkills.filter((skill) => skill.id !== id) }));
  };

  const removeMcp = (id: string) => {
    setSettings((current) => ({ ...current, customMcps: (current.customMcps ?? []).filter((mcp) => mcp.id !== id) }));
  };

  const globalSkills = settings.customSkills.filter((skill) => skill.scope === "global");
  const projectSkills = settings.customSkills.filter((skill) => skill.scope !== "global");
  const globalMcps = (settings.customMcps ?? []).filter((mcp) => mcp.scope === "global");
  const projectMcps = (settings.customMcps ?? []).filter((mcp) => mcp.scope !== "global");

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm">
      <div className="absolute inset-x-4 top-4 bottom-4 mx-auto flex max-w-5xl flex-col overflow-hidden rounded-xl border border-white/10 bg-[#141721] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/8 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">Surya AI Code Settings</h2>
            <p className="text-[11px] text-gray-500">{projectName || "Draft project"} · Skills and MCPs</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-white/5 hover:text-white">
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-6">
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <Globe2 size={13} className="text-surya-500" />
              Global Skills
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {globalSkills.length === 0 ? (
                <p className="col-span-full rounded-lg border border-white/8 bg-surface-2/50 px-3 py-4 text-xs text-gray-500">
                  No global skills created yet.
                </p>
              ) : globalSkills.map((skill) => (
                <ResourceCard key={`global-${skill.id}`} title={skill.label} detail={skill.instructions} onDelete={() => removeSkill(skill.id)} />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <FolderGit2 size={13} className="text-surya-accent" />
              Project Skills
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {projectSkills.length === 0 ? (
                <p className="col-span-full rounded-lg border border-white/8 bg-surface-2/50 px-3 py-4 text-xs text-gray-500">
                  No project skills created yet. Ask chat to create one.
                </p>
              ) : projectSkills.map((skill) => (
                <ResourceCard key={`project-${skill.id}`} title={skill.label} detail={skill.instructions} onDelete={() => removeSkill(skill.id)} />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <Wrench size={13} className="text-surya-500" />
              MCP Servers
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] text-gray-500">Global</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {globalMcps.length === 0 ? (
                    <p className="col-span-full rounded-lg border border-white/8 bg-surface-2/50 px-3 py-4 text-xs text-gray-500">
                      No global MCPs connected yet.
                    </p>
                  ) : globalMcps.map((mcp) => (
                    <ResourceCard key={`global-mcp-${mcp.id}`} title={mcp.label} detail={mcp.url} onDelete={() => removeMcp(mcp.id)} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] text-gray-500">Project</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {projectMcps.length === 0 ? (
                    <p className="col-span-full rounded-lg border border-white/8 bg-surface-2/50 px-3 py-4 text-xs text-gray-500">
                      No project MCPs connected yet. Ask chat to connect one.
                    </p>
                  ) : projectMcps.map((mcp) => (
                    <ResourceCard key={`project-mcp-${mcp.id}`} title={mcp.label} detail={mcp.url} onDelete={() => removeMcp(mcp.id)} />
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white">Create Skill</p>
              <p className="text-[10px] text-gray-600">Also works through chat.</p>
            </div>
            <div className="flex gap-2">
              {(["project", "global"] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setSkillScope(scope)}
                  className={`h-7 rounded-lg px-3 text-[11px] ${skillScope === scope ? "bg-surya-500 text-white" : "bg-surface-2 text-gray-500"}`}
                >
                  {scope}
                </button>
              ))}
            </div>
            <input
              value={skillName}
              onChange={(event) => setSkillName(event.target.value)}
              placeholder="Skill name"
              className="h-8 w-full rounded-lg border border-white/10 bg-surface-2 px-3 text-xs text-white outline-none placeholder:text-gray-600 focus:border-surya-500/50"
            />
            <textarea
              value={skillBody}
              onChange={(event) => setSkillBody(event.target.value)}
              placeholder="Instructions for this skill"
              rows={4}
              className="w-full resize-none rounded-lg border border-white/10 bg-surface-2 px-3 py-2 text-xs text-white outline-none placeholder:text-gray-600 focus:border-surya-500/50"
            />
            <button
              onClick={addSkill}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surya-500 px-3 text-xs font-medium text-white hover:bg-surya-500/85"
            >
              <Plus size={13} />
              Create skill
            </button>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-white">Connect MCP</p>
              <p className="text-[10px] text-gray-600">Also works through chat.</p>
            </div>
            <div className="flex gap-2">
              {(["project", "global"] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setMcpScope(scope)}
                  className={`h-7 rounded-lg px-3 text-[11px] ${mcpScope === scope ? "bg-surya-accent text-white" : "bg-surface-2 text-gray-500"}`}
                >
                  {scope}
                </button>
              ))}
            </div>
            <input
              value={mcpName}
              onChange={(event) => setMcpName(event.target.value)}
              placeholder="MCP name"
              className="h-8 w-full rounded-lg border border-white/10 bg-surface-2 px-3 text-xs text-white outline-none placeholder:text-gray-600 focus:border-surya-accent/50"
            />
            <input
              value={mcpUrl}
              onChange={(event) => setMcpUrl(event.target.value)}
              placeholder="MCP URL or command"
              className="h-8 w-full rounded-lg border border-white/10 bg-surface-2 px-3 text-xs text-white outline-none placeholder:text-gray-600 focus:border-surya-accent/50"
            />
            <button
              onClick={addMcp}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surya-accent px-3 text-xs font-medium text-white hover:bg-surya-accent/85"
            >
              <Plus size={13} />
              Connect MCP
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

const STATUS_PILL: Partial<Record<WCStatus, { label: string; color: string }>> = {
  booting:    { label: "Booting container", color: "text-[#7dd3fc]" },
  installing: { label: "Installing deps", color: "text-[#7dd3fc]" },
  starting:   { label: "Starting server", color: "text-[#8fb7ff]" },
  ready:      { label: "● Live", color: "text-[#78c679]" },
  error:      { label: "Error", color: "text-[#ff8f8f]" },
};

type Props = UseAppBuilderReturn;

function AssistantDots() {
  return (
    <div className="flex gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-surya-500"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  );
}

function UserMessageBubble({ content }: { content: string }) {
  const parsed = parseMessageFileBlocks(content);
  return (
    <div className="max-w-[90%] space-y-2">
      {parsed.attachments.map((attachment, index) => (
        <DocumentAttachmentCard
          key={`${attachment.name}-${index}`}
          mode="message"
          name={attachment.name}
          content={attachment.content}
          sizeBytes={attachment.sizeBytes}
          lineCount={attachment.lineCount}
          subtitle={attachment.truncated ? "Document · truncated" : "Document"}
          className="bg-[#111f38]"
        />
      ))}
      {parsed.visibleText && (
        <div className="rounded-md border border-[#2a3b5f] bg-[#172033] px-3 py-2 text-sm text-[#e5edf8] whitespace-pre-wrap">
          {parsed.visibleText}
        </div>
      )}
    </div>
  );
}

export function AppBuilderChatPanel({
  messages,
  isStreaming,
  elapsedSeconds,
  previewMode,
  wcStatus,
  sendMessage,
  submitClarifyAnswers,
  skipClarify,
  stopGeneration,
  retry,
  buildFromPlan,
  fixBug,
  reset,
  buildError,
  projectId,
  projectName,
  files,
  selectedElement,
  setSelectedElement,
}: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [codeSettings, setCodeSettings] = useState<CodeSettingsState>(DEFAULT_CODE_SETTINGS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasMessages = messages.length > 0;
  const globalSettingsKey = "surya-code-settings:global";
  const projectSettingsKey = `surya-code-settings:project:${projectId ?? "draft"}`;

  const uploadFile = async (file: File, attach = true) => {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File > 5MB");
      return null;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/chat/files", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed");
        return null;
      }
      const att: AttachedFile = data.kind === "image"
        ? { kind: "image", name: data.name, size: data.size, mime: data.mime, dataUrl: data.dataUrl }
        : { kind: "text", name: data.name, size: data.size, mime: data.mime, content: data.content, truncated: data.truncated };
      if (attach) setAttachments((a) => [...a, att]);
      return att;
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    await handlePasteAsFile(e as React.ClipboardEvent<HTMLTextAreaElement>, {
      thresholdChars: LONG_PASTE_CHAR_THRESHOLD,
      thresholdNewlines: LONG_PASTE_LINE_THRESHOLD,
      existingNames: attachments.map((item) => item.name),
      uploadTextFile: async (file) => {
        const attachment = await uploadFile(file, false);
        if (!attachment || attachment.kind !== "text") throw new Error("Upload failed");
        return attachment;
      },
      onAttach: (attachment, meta) => {
        setAttachments((items) => [...items, { ...attachment, name: attachment.name, lineCount: meta.lines, size: meta.sizeBytes }]);
      },
      onError: (error) => setUploadError(error instanceof Error ? error.message : "Upload failed"),
    });
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          // Synthesize friendlier name when clipboard provides "image.png"
          const named = file.name && file.name !== "image.png"
            ? file
            : new File([file], `pasted-${Date.now()}.${(file.type.split("/")[1] || "png")}`, { type: file.type });
          await uploadFile(named);
        }
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    for (const f of files) {
      await uploadFile(f);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const global = loadSettings(globalSettingsKey, DEFAULT_CODE_SETTINGS);
    const project = loadSettings(projectSettingsKey, DEFAULT_CODE_SETTINGS);
    setCodeSettings({
      ...DEFAULT_CODE_SETTINGS,
      globalSkillIds: global.globalSkillIds,
      globalMcpIds: global.globalMcpIds,
      projectSkillIds: project.projectSkillIds,
      projectMcpIds: project.projectMcpIds,
      customMcpUrl: project.customMcpUrl,
      customSkills: [...global.customSkills.map((skill) => ({ ...skill, scope: "global" as const })), ...project.customSkills.map((skill) => ({ ...skill, scope: skill.scope ?? "project" as const }))],
      customMcps: [...(global.customMcps ?? []).map((mcp) => ({ ...mcp, scope: "global" as const })), ...(project.customMcps ?? []).map((mcp) => ({ ...mcp, scope: mcp.scope ?? "project" as const }))],
    });
  }, [projectSettingsKey]);

  useEffect(() => {
    saveSettings(globalSettingsKey, {
      ...DEFAULT_CODE_SETTINGS,
      globalSkillIds: codeSettings.globalSkillIds,
      globalMcpIds: codeSettings.globalMcpIds,
      customSkills: codeSettings.customSkills.filter((skill) => skill.scope === "global"),
      customMcps: (codeSettings.customMcps ?? []).filter((mcp) => mcp.scope === "global"),
    });
    saveSettings(projectSettingsKey, {
      ...DEFAULT_CODE_SETTINGS,
      projectSkillIds: codeSettings.projectSkillIds,
      projectMcpIds: codeSettings.projectMcpIds,
      customMcpUrl: codeSettings.customMcpUrl,
      customSkills: codeSettings.customSkills.filter((skill) => skill.scope !== "global"),
      customMcps: (codeSettings.customMcps ?? []).filter((mcp) => mcp.scope !== "global"),
    });
  }, [projectSettingsKey, codeSettings]);

  const handleSend = () => {
    const text = input.trim();
    if ((!text && attachments.length === 0 && !selectedElement) || isStreaming) return;
    setInput("");
    if (text) captureChatResource(text, setCodeSettings);

    let finalPrompt = text;

    if (text.startsWith("/") && attachments.length === 0 && !selectedElement) {
      setAttachments([]);
      sendMessage(text, undefined, text);
      return;
    }

    if (selectedElement) {
      finalPrompt = `${selectedElement}\n\nUser request: ${text || "(fix this element)"}`;
      setSelectedElement(null);
    }

    const textFiles = attachments.filter((a) => a.kind === "text");
    const imageFiles = attachments.filter((a) => a.kind === "image");

    if (textFiles.length > 0) {
      const ctx = textFiles
        .map((f) => `<file name="${f.name}"${f.truncated ? ' truncated="true"' : ""}>\n${f.content ?? ""}\n</file>`)
        .join("\n\n");
      finalPrompt = ctx + "\n\n" + finalPrompt;
    }

    const images = imageFiles
      .map((f) => f.dataUrl)
      .filter((u): u is string => typeof u === "string");

    setAttachments([]);
    const displayPrompt = finalPrompt || "(see attached image)";
    sendMessage(
      buildIdePrompt(codeSettings, displayPrompt),
      images.length > 0 ? images : undefined,
      displayPrompt
    );
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    for (const f of files) {
      await uploadFile(f);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const pill = previewMode === "webcontainer" ? STATUS_PILL[wcStatus] : null;

  return (
    <div
      className="relative flex flex-col h-full bg-[#0b1220] overflow-hidden text-[#dbeafe]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-surya-500/10 border-2 border-dashed border-surya-500/60 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-surya-500">
            <Upload size={28} />
            <p className="text-sm font-medium">Drop image to attach</p>
          </div>
        </div>
      )}

      <CodeSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        projectName={projectName}
        settings={codeSettings}
        setSettings={setCodeSettings}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#23314d] flex-shrink-0 bg-[#111827]">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-[#3b82f6]" />
          <span className="text-sm font-semibold text-[#e5edf8]">Surya Code</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#1e3a5f] text-[#7dd3fc] border border-[#2b4774]">
            Opus 4.6
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-[#172033] text-[#93a4bd] border border-[#23314d]">
            <Cpu size={10} />
            coding expert
          </span>
        </div>
        <div className="flex items-center gap-1">
          {Object.keys(files).length > 0 && (
            <>
              <PushToGitHub files={files} />
              <DeployToVercel files={files} />
            </>
          )}
          {buildError && (
            <button
            onClick={() => fixBug(buildError)}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2563eb] px-2 text-[11px] text-[#7dd3fc] hover:bg-[#1d4f8f]"
            >
              <Wrench size={12} />
              Fix bug
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            title="Code settings"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[#2a3b5f] px-2 text-[11px] text-[#94a3b8] hover:border-[#3b82f6] hover:text-[#e5edf8]"
          >
            <Settings size={12} />
            Settings
          </button>
          {hasMessages && (
            <button
              onClick={reset}
              title="Start over"
              className="p-1.5 text-[#64748b] hover:text-[#e5edf8] hover:bg-[#1e3a5f] rounded transition-colors"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-[#0b1220]">
        <AnimatePresence initial={false}>
          {!hasMessages ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex h-full flex-col justify-between gap-6 pb-2"
            >
              <div className="pt-8">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#2b4774] bg-[#172033]">
                    <GitPullRequest size={16} className="text-[#3b82f6]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#e5edf8]">New coding session</p>
                    <p className="text-xs text-[#64748b]">Opus 4.6 plans, edits, tests, and reviews.</p>
                  </div>
                </div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[#64748b]">Suggested tasks</p>
              <div className="grid grid-cols-1 gap-1.5 w-full">
                {EXAMPLE_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(buildIdePrompt(codeSettings, p), undefined, p)}
                    className="group flex items-center gap-2 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-[13px] text-[#cbd5e1] transition-all hover:border-[#2a3b5f] hover:bg-[#172033] hover:text-[#e5edf8]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full border border-[#64748b] group-hover:border-[#3b82f6]" />
                    <span className="truncate">{p}</span>
                  </button>
                ))}
              </div>
              </div>
              <div className="rounded-md border border-[#23314d] bg-[#111827] px-3 py-2 text-[11px] text-[#94a3b8]">
                <span className="text-[#7dd3fc]">Bypass permissions</span>
                <span className="mx-2 text-[#475569]">+</span>
                Local workspace · Opus 4.6 · High
              </div>
            </motion.div>
          ) : (
            messages.map((msg, idx) => {
              const isLast = idx === messages.length - 1;
              return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <UserMessageBubble content={msg.content} />
                ) : msg.kind === "clarify" && msg.questions ? (
                  <div className="max-w-[92%] w-full">
                    <ClarifyQuestions
                      messageId={msg.id}
                      questions={msg.questions}
                      answered={!!msg.answered}
                      initialAnswers={msg.answers ?? {}}
                      onSubmit={submitClarifyAnswers}
                      onSkip={skipClarify}
                      disabled={isStreaming}
                    />
                  </div>
                ) : (
                  <div className="max-w-[96%] text-sm text-[#dbeafe] space-y-2">
                    {msg.error && (
                      <div className="flex items-center gap-1.5 text-red-400 text-xs">
                        <AlertCircle size={12} />
                        <span>Generation failed</span>
                      </div>
                    )}
                    {(msg.plan || (msg.isStreaming && typeof msg.thoughtSeconds === "number")) && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#64748b]">
                          <Sparkles size={10} className="text-[#3b82f6]" />
                          <span>
                            Thought for {msg.thoughtSeconds ?? elapsedSeconds}s
                          </span>
                        </div>
                        {msg.plan && (
                          <p className="text-[13px] text-[#dbeafe] leading-relaxed">
                            {msg.plan}
                          </p>
                        )}
                      </div>
                    )}
                    {msg.isStreaming && !msg.content && !msg.plan ? (
                      <AssistantDots />
                    ) : (
                      msg.content && (
                        <div className={`text-[12px] text-[#a8b6ce] ${msg.error ? "text-red-300" : ""}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )
                    )}
                    <AgentTimeline events={msg.agentEvents} />
                    <BugWarRoom events={msg.warRoomEvents} />
                    <BuildReplay replay={msg.replay} />
                    {msg.isStreaming && (
                      <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
                        <Loader2 size={10} className="animate-spin" />
                        <span>Generating… {elapsedSeconds}s</span>
                      </div>
                    )}
                    {msg.error && isLast && !isStreaming && (
                      <button
                        onClick={retry}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surya-500/10 hover:bg-surya-500/20 border border-surya-500/30 text-surya-500 text-xs transition-colors"
                      >
                        <RefreshCw size={11} />
                        Retry
                      </button>
                    )}
                    {msg.followUps && msg.followUps.length > 0 && !msg.isStreaming && (
                      <div className="pt-2 space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wide text-[#64748b]">
                          Try next
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.followUps.map((s, i) => (
                            <button
                              key={i}
                              onClick={() =>
                                s === "Build from this plan" && msg.planPrompt
                                  ? buildFromPlan(msg.planPrompt, null, msg.planImages)
                                  : sendMessage(buildIdePrompt(codeSettings, s), undefined, s)
                              }
                              disabled={isStreaming}
                              className="inline-flex items-center gap-1 rounded-md border border-[#2a3b5f] bg-[#111827] px-2.5 py-1 text-[11px] text-[#cbd5e1] transition-all hover:border-[#3b82f6] hover:text-[#e5edf8] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {s}
                              <ArrowRight size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
              );
            })
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-[#23314d] bg-[#111827] space-y-2">
        {pill && (
          <div className={`text-[11px] font-medium text-center ${pill.color}`}>
            {pill.label}
          </div>
        )}

        {/* Element selection banner */}
        {selectedElement && (
          <div className="flex items-start gap-2 rounded-md border border-[#2563eb] bg-[#102447] px-2.5 py-2">
            <Crosshair size={12} className="text-[#7dd3fc] mt-0.5 shrink-0" />
            <span className="text-[11px] text-[#dbeafe] flex-1 line-clamp-2 leading-relaxed">{selectedElement}</span>
            <button
              onClick={() => setSelectedElement(null)}
              className="p-0.5 text-gray-500 hover:text-gray-200 rounded"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Attachment cards */}
        {(attachments.length > 0 || uploading || uploadError) && (
          <div className="flex flex-col gap-2">
            {attachments.map((f, i) => (
              f.kind === "image" && f.dataUrl ? (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    className="h-14 w-14 rounded-lg object-cover border border-white/10"
                  />
                  <button
                    onClick={() => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 p-0.5 rounded-full bg-black/80 border border-white/10 text-gray-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} />
                  </button>
                </div>
              ) : (
                <DocumentAttachmentCard
                  key={`${f.name}-${i}`}
                  mode="composer"
                  name={f.name}
                  sizeBytes={f.size}
                  lineCount={f.lineCount}
                  subtitle={f.truncated ? "Document · truncated" : "Document"}
                  onRemove={() => setAttachments((a) => a.filter((_, idx) => idx !== i))}
                />
              )
            ))}
            {uploading && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-2 text-[11px] text-gray-400">
                <Loader2 size={10} className="animate-spin" /> Uploading…
              </div>
            )}
            {uploadError && (
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 text-[11px] text-red-400 border border-red-500/30">
                {uploadError}
                <button onClick={() => setUploadError(null)} className="p-0.5"><X size={10} /></button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-md border border-[#334b75] bg-[#172033] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors focus-within:border-[#3b82f6]">
          {/* File attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file"
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-[#64748b] hover:text-[#e5edf8] hover:bg-[#1e3a5f] transition-colors disabled:opacity-40"
          >
            <Plus size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.csv,.txt,.ts,.tsx,.js,.jsx,.py,.md,.png,.jpg,.jpeg,.gif,.webp,image/*"
            onChange={handleFileSelect}
          />

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onPaste={handlePaste}
            placeholder={
              selectedElement
              ? "What should I fix about this element?"
                : hasMessages
                ? "Describe next edit..."
                : "Describe a task or ask a question"
            }
            rows={1}
            className="flex-1 bg-transparent text-sm text-[#e5edf8] placeholder:text-[#64748b] resize-none outline-none max-h-32 overflow-y-auto"
            style={{ minHeight: "24px" }}
          />
          {isStreaming ? (
            <button
              onClick={stopGeneration}
              title="Stop generation"
              className="flex-shrink-0 w-7 h-7 rounded-md bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-all"
            >
              <Square size={11} className="text-white fill-white" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() && attachments.length === 0 && !selectedElement}
              className="flex-shrink-0 w-7 h-7 rounded-md bg-[#3b82f6] hover:bg-[#60a5fa] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all"
            >
              <Send size={13} className="text-white" />
            </button>
          )}
        </div>
        <p className="text-[10px] text-[#64748b] text-center">
          Enter to send · Shift+Enter newline · Opus 4.6 via InsForge Gateway
        </p>
      </div>
    </div>
  );
}
