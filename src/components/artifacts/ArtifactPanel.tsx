"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, Code2, FileText, Play, Image as ImageIcon, Video } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { CodeArtifact } from "./CodeArtifact";
import { DocumentArtifact } from "./DocumentArtifact";
import { InteractiveArtifact } from "./InteractiveArtifact";

const TYPE_ICONS = {
  code: Code2,
  document: FileText,
  interactive: Play,
  image: ImageIcon,
  video: Video,
} as const;

const TYPE_LABELS = {
  code: "Code",
  document: "Document",
  interactive: "Interactive",
  image: "Image",
  video: "Video",
} as const;

const TYPE_COLORS = {
  code: "text-blue-400 bg-blue-400/10",
  document: "text-purple-400 bg-purple-400/10",
  interactive: "text-green-400 bg-green-400/10",
  image: "text-pink-400 bg-pink-400/10",
  video: "text-orange-400 bg-orange-400/10",
} as const;

export function ArtifactPanel() {
  const { artifactPanelOpen, activeArtifact, setArtifactPanel } = useUIStore();

  return (
    <AnimatePresence>
      {artifactPanelOpen && activeArtifact && (
        <motion.div
          key="artifact-panel"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="flex flex-col w-[42%] min-w-[380px] max-w-[680px] h-full border-l border-white/10 bg-surface-1 overflow-hidden shrink-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {(() => {
                const Icon = TYPE_ICONS[activeArtifact.type];
                return (
                  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${TYPE_COLORS[activeArtifact.type]}`}>
                    <Icon size={11} />
                    {TYPE_LABELS[activeArtifact.type]}
                  </span>
                );
              })()}
              <h2 className="text-sm font-medium text-white truncate">
                {activeArtifact.title}
              </h2>
            </div>
            <button
              onClick={() => setArtifactPanel(false)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0 ml-2"
              aria-label="Close artifact panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeArtifact.type === "code" && (
              <CodeArtifact artifact={activeArtifact} />
            )}
            {activeArtifact.type === "document" && (
              <DocumentArtifact artifact={activeArtifact} />
            )}
            {activeArtifact.type === "interactive" && (
              <InteractiveArtifact artifact={activeArtifact} />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
