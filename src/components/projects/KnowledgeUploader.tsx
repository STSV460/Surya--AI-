"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, FileText, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeFile } from "@/types/project";

const ACCEPTED = ".pdf,.csv,.txt,.ts,.tsx,.js,.jsx,.py,.md";
const MAX_FILE_MB = 10;

interface KnowledgeUploaderProps {
  files: KnowledgeFile[];
  projectId: string;
  uploading: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (fileId: string) => Promise<void>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgeUploader({ files, uploading, onUpload, onDelete }: KnowledgeUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(async (fileList: FileList) => {
    setError(null);
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setError(`${file.name} exceeds ${MAX_FILE_MB}MB limit`);
        continue;
      }
      try {
        await onUpload(file);
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
    }
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-5 cursor-pointer transition-all text-center",
          dragOver
            ? "border-surya-500/60 bg-surya-500/8"
            : "border-white/10 hover:border-surya-500/30 hover:bg-surface-2/50"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={20} className="text-surya-500 animate-spin" />
            <p className="text-xs text-gray-400">Uploading…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload size={18} className="text-gray-500" />
            <p className="text-xs text-gray-400">Drop files here or click to upload</p>
            <p className="text-[10px] text-gray-600">PDF, CSV, TXT, TS, JS, PY, MD · Max 10MB each</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-2 px-3 py-2 bg-surface-2 rounded-lg group"
            >
              <FileText size={13} className="text-surya-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white truncate">{file.name}</p>
                <p className="text-[10px] text-gray-600">{formatBytes(file.size)}</p>
              </div>
              <button
                onClick={() => onDelete(file.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-600 hover:text-red-400 transition-all"
                title="Remove file"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
